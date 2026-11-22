from datetime import timedelta
from typing import Literal
from pydantic import Field
from uuid import UUID,uuid4
from fastapi import APIRouter,Depends,Request,Response,UploadFile,File,Query
from sqlalchemy import select,func,update,delete,or_
from sqlalchemy.orm import Session
from models import User,Service,PortfolioProject,PortfolioImage,MediaFile,Review
from app.models import ProjectRequest,RequestContact,RequestBlock,RequestStatusHistory,RequestClaimCode,RequestClaimEvent
from app.db import db_session
from app.admin_auth import require_admin,current_admin
from app.admin_schemas import ServiceEdit,PortfolioEdit,PortfolioOrder,ChangeStatus,ManualClaim,Status
from app.rate_limit import fail, hit
from app.schemas import Schema
from app.api import summary,ip,current
from app.security import now,claim_code,normalize_code,secret_hash
from app.storage import storage,process_image,delete_files
from app.config import settings

router=APIRouter(prefix='/api/admin',dependencies=[Depends(require_admin)])
public=APIRouter(prefix='/api')
DB=Depends(db_session)
ADMIN=Depends(require_admin)
CODES=('site','app','small','study')
def service_dict(s):return {'code':s.code,'title':s.title,'description':s.description,'features':s.features,'price_from':s.price_from,'position':s.position}
@public.get('/services')
def services(db:Session=DB):return [service_dict(s) for s in db.scalars(select(Service).where(Service.code.in_(CODES)).order_by(Service.position))]
@router.get('/services')
def admin_services(db:Session=DB):return services(db)
@router.put('/services/{code}')
def edit_service(code:str,data:ServiceEdit,admin:User=ADMIN,db:Session=DB):
    s=db.scalar(select(Service).where(Service.code==code,Service.code.in_(CODES)).with_for_update())
    if not s:fail(404,'not_found','Услуга не найдена.')
    for key,value in data.model_dump().items():setattr(s,key,value)
    if data.price_from is not None:s.base_price=data.price_from
    s.updated_by_user_id=admin.id;s.updated_at=now();db.commit();return service_dict(s)

def media_dict(m):
    store=storage();return {'media_id':str(m.id),'url':store.url(m.key_full),'thumb_url':store.url(m.key_thumb),'width':m.width,'height':m.height}

def project_dict(db,p,admin=False):
    images=[]
    for image,m in db.execute(select(PortfolioImage,MediaFile).join(MediaFile,PortfolioImage.media_id==MediaFile.id).where(PortfolioImage.project_id==p.id).order_by(PortfolioImage.position)):
        images.append({**media_dict(m),'alt_text':image.alt_text,'alt':image.alt_text,'is_cover':image.is_cover,'position':image.position})
    cover=next((i for i in images if i['is_cover']),images[0] if images else None)
    result={'id':str(p.id),'title':p.title,'kind':p.kind,'description':p.description,'position':p.position,'cover':cover,'images':images,'published_at':p.published_at}
    if admin:result['status']=p.status
    return result

@public.get('/portfolio')
def portfolio(req:Request,response:Response,preview:int=0,db:Session=DB):
    admin,_=current_admin(db,req,False) if preview==1 else (None,None)
    query=select(PortfolioProject).order_by(PortfolioProject.position,PortfolioProject.created_at)
    if not admin:query=query.where(PortfolioProject.status=='published')
    rows=[project_dict(db,p,bool(admin)) for p in db.scalars(query)]
    if admin:response.headers['Cache-Control']='private, no-store'
    db.commit();return rows

@router.post('/media')
def upload(file:UploadFile=File(...),admin:User=ADMIN,db:Session=DB):
    data=file.file.read(settings().max_upload_bytes+1)
    file.file.close();fields,full,thumb=process_image(data);store=storage();keys=[fields['key_full'],fields['key_thumb']]
    try:
        store.save(keys[0],full);store.save(keys[1],thumb)
        media=MediaFile(**fields,created_by_user_id=admin.id);db.add(media);db.commit()
    except Exception:
        db.rollback();delete_files(keys);raise
    return media_dict(media)

@router.get('/portfolio')
def admin_portfolio(db:Session=DB):return [project_dict(db,p,True) for p in db.scalars(select(PortfolioProject).order_by(PortfolioProject.position,PortfolioProject.created_at))]

@router.put('/portfolio/order')
def project_order(data:PortfolioOrder,db:Session=DB):
    projects=db.scalars(select(PortfolioProject).order_by(PortfolioProject.id).with_for_update()).all()
    if len(set(data.ids))!=len(data.ids) or set(data.ids)!={p.id for p in projects}:fail(400,'order_invalid','Обнови список работ и повтори.')
    positions={value:i for i,value in enumerate(data.ids)}
    for p in projects:p.position=positions[p.id];p.sort_order=p.position
    db.commit();return {'ok':True}

def save_project(db,p,data,admin):
    ids=[i.media_id for i in data.images]
    medias=db.scalars(select(MediaFile).where(MediaFile.id.in_(ids)).order_by(MediaFile.id).with_for_update()).all()
    if {m.id for m in medias}!=set(ids):fail(400,'media_invalid','Картинка не найдена. Загрузи её ещё раз.','images')
    occupied=db.scalar(select(PortfolioImage.id).where(PortfolioImage.media_id.in_(ids),PortfolioImage.project_id!=p.id).limit(1))
    if occupied:fail(409,'media_used','Картинка уже принадлежит другой работе.','images')
    previous=db.scalars(select(PortfolioImage).where(PortfolioImage.project_id==p.id)).all()
    removed_ids={i.media_id for i in previous if i.media_id}-set(ids)
    db.execute(delete(PortfolioImage).where(PortfolioImage.project_id==p.id));db.flush()
    for key in ['title','kind','description','status']:setattr(p,key,getattr(data,key))
    p.updated_by_user_id=admin.id;p.updated_at=now();p.is_published=data.status=='published'
    if data.status=='published' and not p.published_at:p.published_at=now()
    for position,i in enumerate(data.images):
        media=next(m for m in medias if m.id==i.media_id)
        db.add(PortfolioImage(project_id=p.id,media_id=media.id,storage_key=media.key_full,alt_text=i.alt_text,position=position,is_cover=i.is_cover))
    removed=db.scalars(select(MediaFile).where(MediaFile.id.in_(removed_ids)).with_for_update()).all()
    keys=[key for m in removed for key in (m.key_full,m.key_thumb)]
    for m in removed:db.delete(m)
    db.commit();delete_files(keys);return project_dict(db,p,True)

@router.post('/portfolio')
def create_project(data:PortfolioEdit,admin:User=ADMIN,db:Session=DB):
    p=PortfolioProject(id=uuid4(),slug=uuid4().hex,title='',description='',position=(db.scalar(select(func.max(PortfolioProject.position))) or 0)+1)
    db.add(p);db.flush();return save_project(db,p,data,admin)
@router.get('/portfolio/{project_id}')
def project(project_id:UUID,db:Session=DB):
    p=db.get(PortfolioProject,project_id)
    if not p:fail(404,'not_found','Работа не найдена.')
    return project_dict(db,p,True)
@router.put('/portfolio/{project_id}')
def update_project(project_id:UUID,data:PortfolioEdit,admin:User=ADMIN,db:Session=DB):
    p=db.scalar(select(PortfolioProject).where(PortfolioProject.id==project_id).with_for_update())
    if not p:fail(404,'not_found','Работа не найдена.')
    return save_project(db,p,data,admin)
@router.delete('/portfolio/{project_id}')
def remove_project(project_id:UUID,db:Session=DB):
    p=db.scalar(select(PortfolioProject).where(PortfolioProject.id==project_id).with_for_update())
    if not p:fail(404,'not_found','Работа не найдена.')
    medias=db.scalars(select(MediaFile).join(PortfolioImage,PortfolioImage.media_id==MediaFile.id).where(PortfolioImage.project_id==p.id).with_for_update(of=MediaFile)).all()
    keys=[key for m in medias for key in (m.key_full,m.key_thumb)]
    db.delete(p);db.flush()
    for m in medias:db.delete(m)
    db.commit();delete_files(keys);return {'ok':True}

def contacts(db,p):return [{'kind':c.kind,'value':c.value} for c in db.scalars(select(RequestContact).where(RequestContact.request_id==p.id))]
def owner(db,p):
    user=db.get(User,p.user_id) if p.user_id else None
    return {'id':str(user.id),'email':user.email} if user else None

def paginated(db,query,page,serialize):
    total=db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    return {'items':[serialize(p) for p in db.scalars(query.offset((page-1)*20).limit(20))],'page':page,'total':total,'pages':max(1,(total+19)//20)}
@router.get('/requests')
def requests(status:Status|None=None,q:str=Query('',max_length=320),unclaimed:bool=False,page:int=Query(1,ge=1),db:Session=DB):
    query=select(ProjectRequest)
    if status:query=query.where(ProjectRequest.status==status)
    if unclaimed:query=query.where(ProjectRequest.user_id.is_(None))
    if q:
        query=query.where(or_(func.concat('DEVUP-',ProjectRequest.number).ilike('%'+q+'%'),ProjectRequest.id.in_(select(RequestContact.request_id).where(RequestContact.value.ilike('%'+q+'%')))))
    return paginated(db,query.order_by(ProjectRequest.created_at.desc()),page,lambda p:{**summary(p),'owner':owner(db,p),'contacts':contacts(db,p)})

def get_request(db,number,lock=False):
    query=select(ProjectRequest).where(ProjectRequest.number==number)
    p=db.scalar(query.with_for_update() if lock else query)
    if not p:fail(404,'not_found','Заявка не найдена.')
    return p
@router.get('/requests/{number}')
def request_detail(number:int,db:Session=DB):
    p=get_request(db,number)
    result={**summary(p),**{k:getattr(p,k) for k in ['wishes_text','design_text','deadline_text','budget_text']},'owner':owner(db,p),'contacts':contacts(db,p)}
    result['blocks']=[{'kind':b.kind,'title':b.title,'description':b.description,'position':b.position} for b in db.scalars(select(RequestBlock).where(RequestBlock.request_id==p.id).order_by(RequestBlock.position))]
    result['history']=[]
    for h in db.scalars(select(RequestStatusHistory).where(RequestStatusHistory.request_id==p.id).order_by(RequestStatusHistory.created_at)):
        actor=db.get(User,h.changed_by_user_id) if h.changed_by_user_id else None
        result['history'].append({'to_status':h.to_status,'from_status':h.from_status,'comment':h.comment,'created_at':h.created_at,'actor':actor.username if actor and actor.role=='manager' else None})
    return result
@router.post('/requests/{number}/status')
def change_status(number:int,data:ChangeStatus,admin:User=ADMIN,db:Session=DB):
    p=get_request(db,number,True)
    if p.status==data.status:fail(400,'status_unchanged','Требуется другой статус.','status')
    db.add(RequestStatusHistory(request_id=p.id,from_status=p.status,to_status=data.status,changed_by_user_id=admin.id,comment=data.comment));p.status=data.status;p.updated_at=now();db.commit();return {'ok':True}
@router.post('/requests/{number}/claim-code')
def new_claim_code(number:int,db:Session=DB):
    p=get_request(db,number,True)
    if p.user_id:fail(409,'owned','У заявки уже есть владелец.')
    db.execute(update(RequestClaimCode).where(RequestClaimCode.request_id==p.id,RequestClaimCode.used_at.is_(None),RequestClaimCode.revoked_at.is_(None)).values(revoked_at=now()));db.flush()
    code=claim_code();db.add(RequestClaimCode(request_id=p.id,code_hash=secret_hash(normalize_code(code))));db.commit();return {'number':p.number,'claim_code':code}
@router.post('/requests/{number}/claim')
def manual_claim(number:int,data:ManualClaim,req:Request,admin:User=ADMIN,db:Session=DB):
    p=get_request(db,number,True)
    user=db.get(User,data.user_id)
    if not user or user.role not in ('client','customer') or not user.email_verified_at:fail(400,'user_invalid','Нужен клиент с подтверждённой почтой.','user_id')
    result=db.execute(update(ProjectRequest).where(ProjectRequest.id==p.id,ProjectRequest.user_id.is_(None)).values(user_id=user.id,claimed_at=now()).returning(ProjectRequest.id))
    if result.scalar_one_or_none() is None:fail(409,'owned','У заявки уже есть владелец.')
    db.execute(update(RequestClaimCode).where(RequestClaimCode.request_id==p.id,RequestClaimCode.used_at.is_(None),RequestClaimCode.revoked_at.is_(None)).values(revoked_at=now()))
    db.add(RequestClaimEvent(request_id=p.id,user_id=user.id,performed_by_user_id=admin.id,method='manager',ip=ip(req)));db.commit();return {'ok':True}

def user_dict(db,u):return {'id':str(u.id),'email':u.email,'verified':u.email_verified_at is not None,'created_at':u.created_at,'last_login_at':u.last_login_at,'request_count':db.scalar(select(func.count()).select_from(ProjectRequest).where(ProjectRequest.user_id==u.id))}
@router.get('/users')
def users(q:str=Query('',max_length=320),page:int=Query(1,ge=1),db:Session=DB):
    query=select(User).where(User.role.in_(('client','customer')))
    if q:query=query.where(User.email.ilike('%'+q+'%'))
    return paginated(db,query.order_by(User.created_at.desc()),page,lambda u:user_dict(db,u))
@router.get('/users/{user_id}')
def user_detail(user_id:UUID,db:Session=DB):
    u=db.get(User,user_id)
    if not u or u.role not in ('client','customer'):fail(404,'not_found','Пользователь не найден.')
    return {**user_dict(db,u),'requests':[summary(p) for p in db.scalars(select(ProjectRequest).where(ProjectRequest.user_id==u.id).order_by(ProjectRequest.created_at.desc()))]}


def review_data(row, service_title):
    return {
        'id': row.id, 'author_name': row.author_name, 'rating': row.rating,
        'body': row.body, 'service': service_title, 'created_at': row.created_at,
    }


def review_query():
    return select(Review, Service.title).join(Service, Review.service_id == Service.id).order_by(
        Review.created_at.desc(), Review.id
    )


@public.get('/reviews')
def public_reviews(db: Session = DB):
    return [review_data(row, title) for row, title in db.execute(
        review_query().where(Review.status == 'published')
    )]


@public.get('/reviews/mine')
def my_reviews(request: Request, db: Session = DB):
    user, _ = current(db, request, True)
    rows = db.execute(review_query().where(Review.user_id == user.id))
    result = [{**review_data(row, title), 'status': row.status} for row, title in rows]
    db.commit()
    return result


@router.get('/reviews')
def admin_reviews(page: int = Query(1, ge=1), db: Session = DB):
    total = db.scalar(select(func.count()).select_from(Review))
    rows = db.execute(review_query().offset((page - 1) * 20).limit(20))
    return {
        'items': [{**review_data(row, title), 'status': row.status} for row, title in rows],
        'pages': max(1, (total + 19) // 20),
    }


@router.delete('/reviews/{review_id}')
def delete_review(review_id: UUID, db: Session = DB):
    removed = db.scalar(delete(Review).where(Review.id == review_id).returning(Review.id))
    if removed is None:
        fail(404, 'not_found', 'Отзыв не найден.')
    db.commit()
    return {'ok': True}


class ReviewSubmission(Schema):
    author_name: str = Field(min_length=1, max_length=120)
    rating: int = Field(strict=True, ge=1, le=5)
    service_code: Literal['site', 'app', 'small', 'study']
    body: str = Field(min_length=1, max_length=2000)


@public.post('/reviews', status_code=201)
def submit_review(data: ReviewSubmission, request: Request, db: Session = DB):
    hit(db, 'reviews:ip:' + ip(request), 5, 3600)
    service = db.scalar(select(Service).where(Service.code == data.service_code))
    if service is None:
        fail(422, 'service_required', 'Услуга должна быть выбрана.', 'service_code')
    user, _ = current(db, request)
    row = Review(user_id=user.id if user else None, service_id=service.id,
                 author_name=data.author_name, rating=data.rating, body=data.body, status='pending')
    db.add(row)
    db.commit()
    return {'status': row.status}


class ReviewModeration(Schema):
    status: Literal['published', 'rejected']


@router.put('/reviews/{review_id}/status')
def moderate_review(review_id: UUID, data: ReviewModeration, db: Session = DB):
    changed = db.scalar(update(Review).where(Review.id == review_id)
                        .values(status=data.status).returning(Review.id))
    if changed is None:
        fail(404, 'not_found', 'Отзыв не найден.')
    db.commit()
    return {'status': data.status}
