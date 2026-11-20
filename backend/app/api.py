from datetime import timedelta
from uuid import UUID,uuid4
import re
from fastapi import APIRouter,Depends,Request,Response,BackgroundTasks
from sqlalchemy import select,update,or_,text
from sqlalchemy.orm import Session
from models import User
from app.db import db_session
from app.config import settings
from app.models import (ProjectRequest,AuthChallenge,ServerSession,RequestBlock,RequestContact,RequestClaimCode,RequestAccessToken,RequestStatusHistory,RequestClaimEvent,EmailLog)
from app.schemas import Register,Credentials,Verify,ChallengeInput,CreateRequest,ByCode,Apply,Contact
from app.security import now,token,digest,secret_hash,matches,verification_code,claim_code,normalize_code,passwords,check_password,DUMMY_HASH
from app.rate_limit import hit,fail
from app.mail import enqueue

router=APIRouter(prefix='/api')
DB=Depends(db_session)
def ip(req): return req.client.host if req.client else 'unknown'
def agent(req): return req.headers.get('user-agent','')[:500]
def cookie(response,name,value,days):
    response.set_cookie(name,value,max_age=days*86400,httponly=True,secure=settings().cookie_secure,samesite='lax',path='/')
def public_user(user): return {'id':str(user.id),'email':user.email,'role':user.role}
def current(db,req,required=False):
    raw=req.cookies.get('devup_session','')
    session=db.scalar(select(ServerSession).where(ServerSession.token_hash==digest(raw),ServerSession.kind=='client',ServerSession.created_at>now()-timedelta(days=settings().session_max_days),ServerSession.revoked_at.is_(None),ServerSession.expires_at>now())) if raw else None
    user=db.get(User,session.user_id) if session else None
    if user and (not user.is_active or not user.email_verified_at or user.role not in ('client','customer')): user=None
    if user:
        session.last_seen_at=now()
        session.expires_at=min(now()+timedelta(days=settings().session_days),session.created_at+timedelta(days=settings().session_max_days))
        req.state.session_expires=session.expires_at
    if not user and required: fail(401,'unauthorized','Сначала войди в аккаунт.')
    return user,session

def issue_session(db,user,req,response):
    raw=token();at=now()
    db.add(ServerSession(user_id=user.id,token_hash=digest(raw),expires_at=at+timedelta(days=settings().session_days),last_seen_at=at,ip=ip(req),user_agent=agent(req)))
    user.last_login_at=at;cookie(response,'devup_session',raw,settings().session_days)

def mail_limits(db,email,req):
    cfg=settings();hit(db,'mail:cooldown:'+email,1,cfg.resend_seconds);hit(db,'mail:email:'+email,cfg.mail_email_limit,3600);hit(db,'mail:ip:'+ip(req),cfg.mail_ip_limit,3600)

def new_challenge(db,user,purpose,pending,req,tasks):
    cfg=settings();at=now();code=verification_code()
    db.execute(update(AuthChallenge).where(AuthChallenge.user_id==user.id,AuthChallenge.consumed_at.is_(None)).values(consumed_at=at))
    c=AuthChallenge(id=uuid4(),user_id=user.id,purpose=purpose,code_hash='',expires_at=at+timedelta(minutes=cfg.code_minutes),max_attempts=cfg.code_attempts,last_sent_at=at,pending_request_id=pending,ip=ip(req),user_agent=agent(req))
    c.code_hash=secret_hash(code,str(c.id));db.add(c);db.flush()
    mail_id=enqueue(db,tasks,user.email,'admin_code' if purpose=='admin_login' else 'code',{'code':code})
    return {'challenge_id':str(c.id),'mail_id':mail_id,'resend_after':cfg.resend_seconds}

def number_value(value):
    value=value.upper().strip().removeprefix('DEVUP-')
    if not value.isdigit(): fail(400,'claim_invalid','Проверь номер заявки и код.','number')
    return int(value)

def validate_claim(db,number,code,req):
    cfg=settings();hit(db,'claim:ip:'+ip(req),cfg.claim_ip_limit,3600)
    n=number_value(number)
    hit(db,'claim:request:'+str(n),cfg.claim_request_limit,3600)
    project=db.scalar(select(ProjectRequest).where(ProjectRequest.number==n,ProjectRequest.user_id.is_(None)).with_for_update())
    row=db.scalar(select(RequestClaimCode).where(RequestClaimCode.request_id==project.id,RequestClaimCode.used_at.is_(None),RequestClaimCode.revoked_at.is_(None)).with_for_update()) if project else None
    if not row or (row.locked_until and row.locked_until>now()) or not matches(normalize_code(code),row.code_hash):
        if row:
            row.failed_attempts+=1
            if row.failed_attempts>=cfg.claim_request_limit: row.locked_until=now()+timedelta(hours=1)
            db.commit()
        fail(400,'claim_invalid','Проверь номер заявки и код.','claim_code')
    return project

def claim(db,project_id,user,method,req):
    result=db.execute(update(ProjectRequest).where(ProjectRequest.id==project_id,ProjectRequest.user_id.is_(None)).values(user_id=user.id,claimed_at=now()).returning(ProjectRequest.id))
    if result.scalar_one_or_none() is None: return False
    db.execute(update(RequestClaimCode).where(RequestClaimCode.request_id==project_id,RequestClaimCode.used_at.is_(None),RequestClaimCode.revoked_at.is_(None)).values(used_at=now()))
    db.add(RequestClaimEvent(request_id=project_id,user_id=user.id,method=method,ip=ip(req)))
    return True

def browser_ids(db,req):
    raws=req.cookies.get('devup_guest','').split('.')[-10:]
    return set(db.scalars(select(RequestAccessToken.request_id).where(RequestAccessToken.token_hash.in_([digest(x) for x in raws if x]),RequestAccessToken.revoked_at.is_(None),RequestAccessToken.expires_at>now())))

def summary(p): return {'number':p.number,'display_number':f'DEVUP-{p.number}','project_type':p.project_type,'status':p.status,'company_text':p.company_text,'created_at':p.created_at}
def discover(db,req,user,by_email):
    ids=browser_ids(db,req)
    if by_email and user.email_verified_at:
        ids.update(db.scalars(select(RequestContact.request_id).where(RequestContact.kind=='email',RequestContact.value_normalized==user.email)))
    rows=db.scalars(select(ProjectRequest).where(ProjectRequest.id.in_(ids),ProjectRequest.user_id.is_(None)).order_by(ProjectRequest.created_at.desc())).all()
    return rows

@router.post('/auth/register')
def register(data:Register,req:Request,tasks:BackgroundTasks,db:Session=DB):
    hit(db,'register:ip:'+ip(req),settings().register_ip_limit,3600)
    pending=validate_claim(db,data.number,data.claim_code,req).id if data.number else None
    email=str(data.email)
    db.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:email, 1))'),{'email':email})
    user=db.scalar(select(User).where(User.email==email).with_for_update())
    if user and user.role not in ('client','customer'): fail(400,'credentials','Проверь почту и пароль.')
    mail_limits(db,email,req)
    if user and user.email_verified_at:
        mail_id=enqueue(db,tasks,email,'existing',{})
        db.commit();return {'challenge_id':str(uuid4()),'mail_id':mail_id,'resend_after':settings().resend_seconds}
    if not user:
        user=User(email=email,password_hash=passwords.hash(data.password),display_name='',role='client');db.add(user);db.flush()
    else: user.password_hash=passwords.hash(data.password)
    result=new_challenge(db,user,'register',pending,req,tasks);db.commit();return result

@router.post('/auth/login')
def login(data:Credentials,req:Request,tasks:BackgroundTasks,db:Session=DB):
    cfg=settings();email=str(data.email)
    hit(db,'login:ip:'+ip(req),cfg.login_ip_limit,900);hit(db,'login:email:'+email,cfg.login_email_limit,900)
    user=db.scalar(select(User).where(User.email==email))
    valid=check_password(data.password,user.password_hash if user else DUMMY_HASH)
    if not valid or not user or not user.is_active or not user.email_verified_at or user.role not in ('client','customer'): fail(400,'credentials','Проверь почту и пароль.')
    mail_limits(db,email,req);result=new_challenge(db,user,'login',None,req,tasks);db.commit();return result

@router.post('/auth/verify')
def verify(data:Verify,req:Request,response:Response,db:Session=DB):
    c=db.scalar(select(AuthChallenge).where(AuthChallenge.id==data.challenge_id).with_for_update())
    if not c or c.purpose not in ('register','login') or c.consumed_at or c.expires_at<=now() or c.attempts>=c.max_attempts: fail(400,'code_expired','Код больше не действует. Начни вход заново.')
    if not matches(data.code,c.code_hash,str(c.id)):
        c.attempts+=1
        if c.attempts>=c.max_attempts: c.consumed_at=now()
        left=max(0,c.max_attempts-c.attempts);db.commit();fail(400,'code_invalid',f'Неверный код. Осталось попыток: {left}.','code')
    user=db.get(User,c.user_id)
    if not user or not user.is_active: fail(400,'code_expired','Начни вход заново.')
    c.consumed_at=now();user.email_verified_at=user.email_verified_at or now()
    linked=False
    if c.pending_request_id: linked=claim(db,c.pending_request_id,user,'registration_code',req)
    issue_session(db,user,req,response)
    candidates=discover(db,req,user,False)
    db.commit();return {'user':public_user(user),'claimable':[summary(p) for p in candidates],'registration_claimed':linked}

@router.post('/auth/resend')
def resend(data:ChallengeInput,req:Request,tasks:BackgroundTasks,db:Session=DB):
    cfg=settings();c=db.scalar(select(AuthChallenge).where(AuthChallenge.id==data.challenge_id).with_for_update())
    if not c:
        hit(db,'resend:ip:'+ip(req),cfg.mail_ip_limit,3600)
        return {'resend_after':cfg.resend_seconds}
    if c.purpose not in ('register','login') or c.consumed_at or c.expires_at<=now() or c.resend_count>=cfg.resend_max: fail(400,'code_expired','Начни вход заново.')
    seconds=(now()-c.last_sent_at).total_seconds()
    if seconds<cfg.resend_seconds: fail(429,'resend_wait','Подожди перед новой отправкой.',retry=max(1,int(cfg.resend_seconds-seconds)+1))
    user=db.get(User,c.user_id);mail_limits(db,user.email,req)
    code=verification_code();c.code_hash=secret_hash(code,str(c.id));c.resend_count+=1;c.last_sent_at=now();c.expires_at=now()+timedelta(minutes=cfg.code_minutes)
    mail_id=enqueue(db,tasks,user.email,'code',{'code':code});db.commit();return {'resend_after':cfg.resend_seconds,'mail_id':mail_id}

@router.get('/auth/me')
def me(req:Request,db:Session=DB):
    user,session=current(db,req);db.commit();return {'user':public_user(user) if user else None}

@router.post('/auth/logout')
def logout(req:Request,response:Response,db:Session=DB):
    user,session=current(db,req,True);session.revoked_at=now();db.commit();response.delete_cookie('devup_session',path='/');return {'ok':True}

@router.post('/requests')
def create_request(data:CreateRequest,req:Request,response:Response,tasks:BackgroundTasks,db:Session=DB):
    user,_=current(db,req);cfg=settings()
    hit(db,('requests:user:'+str(user.id)) if user else 'requests:ip:'+ip(req),cfg.user_request_limit if user else cfg.guest_request_limit,3600)
    contacts = data.contacts
    if not contacts:
        if not user:
            fail(422, 'contact_required', 'Оставь хотя бы один контакт.', 'contacts')
        saved = {'email': Contact(kind='email', value=user.email)}
        previous = db.scalars(select(RequestContact).join(
            ProjectRequest, RequestContact.request_id == ProjectRequest.id
        ).where(ProjectRequest.user_id == user.id, RequestContact.kind.in_(('telegram', 'vk')))
          .order_by(ProjectRequest.created_at.desc(), ProjectRequest.number.desc()))
        for contact in previous:
            if contact.kind not in saved:
                saved[contact.kind] = Contact(kind=contact.kind, value=contact.value)
            if len(saved) == 3:
                break
        contacts = list(saved.values())
    project=ProjectRequest(**data.model_dump(exclude={'blocks','contacts','website'}),user_id=user.id if user else None,submitted_ip=ip(req),claimed_at=now() if user else None)
    db.add(project);db.flush()
    for pos,b in enumerate(data.blocks): db.add(RequestBlock(request_id=project.id,position=pos,**b.model_dump()))
    email=None
    for contact in contacts:
        normalized=contact.value.lower() if contact.kind=='email' else re.sub(r'^(?:https?://)?(?:www\.)?(?:(?:t\.me|telegram\.me|vk\.com)/)?@?','',contact.value).rstrip('/')
        db.add(RequestContact(request_id=project.id,kind=contact.kind,value=contact.value,value_normalized=normalized))
        if contact.kind=='email': email=normalized
    db.add(RequestStatusHistory(request_id=project.id,from_status=None,to_status='new',changed_by_user_id=user.id if user else None))
    code=None
    if user: db.add(RequestClaimEvent(request_id=project.id,user_id=user.id,method='auto_submit',ip=ip(req)))
    else:
        code=claim_code();raw=token()
        db.add(RequestClaimCode(request_id=project.id,code_hash=secret_hash(normalize_code(code))))
        db.add(RequestAccessToken(request_id=project.id,token_hash=digest(raw),expires_at=now()+timedelta(days=cfg.guest_days)))
        prior=[x for x in req.cookies.get('devup_guest','').split('.') if re.fullmatch(r'[A-Za-z0-9_-]{43}',x)][-9:]
        cookie(response,'devup_guest','.'.join(prior+[raw]),cfg.guest_days)
    mail_id=enqueue(db,tasks,email,'request',{'number':project.number,'code':code}) if email else None
    db.commit();return {**summary(project),'claim_code':code,'email':email,'mail_id':mail_id}

@router.get('/requests/mine')
def mine(req:Request,db:Session=DB):
    user,_=current(db,req,True)
    rows=db.scalars(select(ProjectRequest).where(ProjectRequest.user_id==user.id).order_by(ProjectRequest.created_at.desc())).all()
    db.commit();return [summary(p) for p in rows]

@router.get('/requests/{number}')
def detail(number:int,req:Request,db:Session=DB):
    user,_=current(db,req)
    p=db.scalar(select(ProjectRequest).where(ProjectRequest.number==number))
    allowed=p and ((user and p.user_id==user.id) or (p.user_id is None and p.id in browser_ids(db,req)))
    if not allowed: fail(404,'not_found','Заявка не найдена.')
    result={**summary(p),**{key:getattr(p,key) for key in ['wishes_text','design_text','deadline_text','budget_text']}}
    result['blocks']=[{'kind':b.kind,'title':b.title,'description':b.description,'position':b.position} for b in db.scalars(select(RequestBlock).where(RequestBlock.request_id==p.id).order_by(RequestBlock.position))]
    result['contacts']=[{'kind':c.kind,'value':c.value} for c in db.scalars(select(RequestContact).where(RequestContact.request_id==p.id))]
    result['history']=[{'from_status':h.from_status,'to_status':h.to_status,'created_at':h.created_at} for h in db.scalars(select(RequestStatusHistory).where(RequestStatusHistory.request_id==p.id).order_by(RequestStatusHistory.created_at))]
    db.commit();return result

@router.post('/claims/discover')
def discover_requests(req:Request,db:Session=DB):
    user,_=current(db,req,True);rows=discover(db,req,user,True);db.commit();return [summary(p) for p in rows]

@router.post('/claims/apply')
def apply_claims(data:Apply,req:Request,db:Session=DB):
    user,_=current(db,req,True);available={p.number:p for p in discover(db,req,user,True)};ids=browser_ids(db,req)
    linked=[]
    for n in set(data.numbers):
        p=available.get(n)
        if p and claim(db,p.id,user,'browser_token' if p.id in ids else 'email_match',req): linked.append(n)
    db.commit();return {'claimed':linked}

@router.post('/claims/by-code')
def by_code(data:ByCode,req:Request,db:Session=DB):
    user,_=current(db,req,True);p=validate_claim(db,data.number,data.claim_code,req)
    if not claim(db,p.id,user,'claim_code',req): fail(409,'claim_taken','Заявка уже привязана.')
    db.commit();return {'claimed':[p.number]}

@router.get('/mail/{mail_id}')
def mail_status(mail_id:UUID,db:Session=DB):
    # UUID is an unguessable delivery receipt, contains no recipient or message content.
    log=db.get(EmailLog,mail_id)
    if not log: fail(404,'not_found','Письмо не найдено.')
    return {'status':log.status,'message':log.error}
