from datetime import timedelta
from io import BytesIO
from uuid import UUID
import pytest
from PIL import Image
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi.testclient import TestClient
from app.db import SessionLocal
from app.main import app
from app.models import AuthChallenge,ServerSession,ProjectRequest,RequestClaimCode,RequestClaimEvent
from models import User,MediaFile,PortfolioImage,Service
from app.admin_cli import create_manager,reset_manager_password
from app.security import now,digest
from test_flows import post,guest,auth,HEAD

def admin_login(client,messages):
 r=post(client,'/admin/auth/login',{'username':'qa_admin','password':'Test-admin-123'});assert r.status_code==200,r.text
 challenge=r.json()['challenge_id'];code=next(m[2]['code'] for m in reversed(messages) if m[1]=='admin_code')
 r=post(client,'/admin/auth/verify',{'challenge_id':challenge,'code':code});assert r.status_code==200,r.text
 return r
@pytest.fixture
def admin(client,isolated_db):admin_login(client,isolated_db);return client

def call(c,method,path,data=None):return c.request(method,'/api'+path,json={} if data is None else data,headers=HEAD)
def image_bytes(format='PNG',size=(1800,1000)):
 b=BytesIO();Image.new('RGB',size,'green').save(b,format=format);return b.getvalue()
def upload(c,data=None,name='photo.png'):
 r=c.post('/api/admin/media',files={'file':(name,data if data is not None else image_bytes(),'image/png')},headers=HEAD);return r

def test_admin_cli_and_constraints():
 for username,password in [('a','Long-password-123'),('invalid name','Long-password-123'),('valid','short')]:
  with pytest.raises(ValueError):create_manager(username,'manager@example.com',password)
 create_manager('new.manager','new-manager@example.com','abcdefgh')
 with SessionLocal() as db:
  u=db.scalar(select(User).where(User.username=='new.manager'));assert u.role=='manager' and u.email_verified_at
 with pytest.raises(IntegrityError):create_manager('new.manager','another@example.com','abcdefgh')
 with pytest.raises(IntegrityError):
  with SessionLocal.begin() as db:db.add(User(email='bad@example.com',role='manager',password_hash='unused',display_name=''))
 reset_manager_password('new.manager','different-password')

def test_admin_session_roles_and_mail(admin,isolated_db):
 assert admin.get('/api/admin/auth/me').json()['admin']['username']=='qa_admin'
 assert admin.get('/api/auth/me').json()['user'] is None
 r=post(admin,'/auth/login',{'email':'qa-admin@example.com','password':'Test-admin-123'});assert r.status_code==400
 assert post(admin,'/auth/register',{'email':'qa-admin@example.com','password':'Test-admin-123'}).status_code==400
 assert post(admin,'/admin/auth/logout',{}).status_code==200
 assert admin.get('/api/admin/services').status_code==401

def test_admin_login_uniform_and_limits(client):
 responses=[]
 for username in ['unknown','qa_admin']:
  r=post(client,'/admin/auth/login',{'username':username,'password':'incorrect'});responses.append(r.json())
 assert responses[0]==responses[1]
 for _ in range(4):post(client,'/admin/auth/login',{'username':'unknown','password':'incorrect'})
 assert post(client,'/admin/auth/login',{'username':'unknown','password':'incorrect'}).status_code==429

def test_admin_code_scope_attempts(client,isolated_db):
 r=post(client,'/admin/auth/login',{'username':'qa_admin','password':'Test-admin-123'});challenge=r.json()['challenge_id']
 assert post(client,'/admin/auth/resend',{'challenge_id':challenge}).status_code==429
 code=isolated_db[-1][2]['code']
 assert post(client,'/auth/verify',{'challenge_id':challenge,'code':code}).status_code==400
 wrong='000000' if code!='000000' else '111111'
 for _ in range(5):assert post(client,'/admin/auth/verify',{'challenge_id':challenge,'code':wrong}).status_code==400
 assert post(client,'/admin/auth/verify',{'challenge_id':challenge,'code':code}).status_code==400

def test_admin_session_expiry(admin):
 raw=admin.cookies['devup_admin']
 with SessionLocal.begin() as db:db.scalar(select(ServerSession).where(ServerSession.token_hash==digest(raw))).created_at=now()-timedelta(hours=9)
 assert admin.get('/api/admin/auth/me').status_code==401

def test_client_cannot_admin(client,isolated_db):
 auth(client,isolated_db)
 assert client.get('/api/admin/requests').status_code==401
 assert upload(client).status_code==401

def test_services_edit(admin):
 rows=admin.get('/api/services').json();assert [r['code'] for r in rows]==['site','app','small','study']
 data={k:rows[0][k] for k in ['title','description','features','price_from']};data['price_from']=None
 assert call(admin,'PUT','/admin/services/site',data).status_code==200
 assert admin.get('/api/services').json()[0]['price_from'] is None
 data['price_from']=-1;assert call(admin,'PUT','/admin/services/site',data).status_code==422
 with pytest.raises(IntegrityError):
  with SessionLocal.begin() as db:db.scalar(select(Service).where(Service.code=='site')).price_from=-1

def test_requests_status_claim_code_and_privacy(admin,isolated_db):
 g=TestClient(app);p=guest(g)
 assert admin.get('/api/admin/requests?unclaimed=true&q=example').json()['total']==1
 r=post(admin,f"/admin/requests/{p['number']}/status",{'status':'in_progress','comment':'Служебный комментарий'})
 assert r.status_code==200
 assert post(admin,f"/admin/requests/{p['number']}/status",{'status':'in_progress'}).status_code==400
 assert 'comment' not in g.get(f"/api/requests/{p['number']}").json()['history'][-1]
 assert admin.get(f"/api/admin/requests/{p['number']}").json()['history'][-1]['actor']=='qa_admin'
 code=post(admin,f"/admin/requests/{p['number']}/claim-code",{}).json()['claim_code'];assert code!=p['claim_code']
 c=TestClient(app);auth(c,isolated_db)
 assert post(c,'/claims/by-code',{'number':str(p['number']),'claim_code':p['claim_code']}).status_code==400
 assert post(c,'/claims/by-code',{'number':str(p['number']),'claim_code':code}).status_code==200
 assert post(admin,f"/admin/requests/{p['number']}/claim-code",{}).status_code==409

def test_users_and_manual_claim(admin,isolated_db):
 p=guest(TestClient(app));c=TestClient(app);auth(c,isolated_db)
 rows=admin.get('/api/admin/users?q=person').json();assert rows['total']==1
 user_id=rows['items'][0]['id'];r=post(admin,f"/admin/requests/{p['number']}/claim",{'user_id':user_id});assert r.status_code==200,r.text
 assert post(admin,f"/admin/requests/{p['number']}/claim",{'user_id':user_id}).status_code==409
 assert admin.get(f'/api/admin/users/{user_id}').json()['request_count']==1
 with SessionLocal() as db:
  event=db.scalar(select(RequestClaimEvent));assert event.method=='manager' and event.performed_by_user_id
  assert db.scalar(select(RequestClaimCode)).revoked_at

def test_media_processing_and_rejection(admin):
 for format in ['PNG','JPEG','WEBP']:
  r=upload(admin,image_bytes(format));assert r.status_code==200,r.text
  with SessionLocal() as db:
   m=db.get(MediaFile,UUID(r.json()['media_id']));assert max(m.width,m.height)<=1600 and m.mime=='image/webp'
  content=admin.get(r.json()['url']);assert content.headers['x-content-type-options']=='nosniff'
  with Image.open(BytesIO(content.content)) as im:assert im.format=='WEBP' and not im.getexif()
 assert upload(admin,b'<svg/>','fake.png').status_code==400
 assert upload(admin,image_bytes('GIF'),'fake.png').status_code==400
 assert upload(admin,b'x'*(5*1024*1024+1)).status_code in (400,413)
 assert upload(admin,image_bytes('PNG',(8001,1))).status_code==400

def test_portfolio_lifecycle_preview_cover_delete(admin):
 one=upload(admin).json();two=upload(admin).json()
 data={'title':'Настоящий проект','kind':'site','description':'Описание','status':'draft','images':[{'media_id':one['media_id'],'is_cover':True},{'media_id':two['media_id']}]}
 r=post(admin,'/admin/portfolio',data);assert r.status_code==200,r.text
 project=r.json();pid=project['id'];assert project['cover']['media_id']==one['media_id']
 assert admin.get('/api/portfolio').json()==[]
 assert TestClient(app).get('/api/portfolio?preview=1').json()==[]
 preview=admin.get('/api/portfolio?preview=1');assert preview.json()[0]['status']=='draft' and 'no-store' in preview.headers['cache-control']
 data['status']='published';data['images'].reverse();data['images'][0]['is_cover']=True;data['images'][1]['is_cover']=False
 assert call(admin,'PUT','/admin/portfolio/'+pid,data).status_code==200
 assert admin.get('/api/portfolio').json()[0]['published_at']
 assert post(admin,'/admin/portfolio',{**data,'title':'Другая'}).status_code==409
 assert call(admin,'DELETE','/admin/portfolio/'+pid).status_code==200
 assert admin.get(one['url']).status_code==404

def test_portfolio_validation_and_cleanup(admin):
 assert post(admin,'/admin/portfolio',{'title':'','status':'published','images':[]}).status_code==422
 media=upload(admin).json()
 from app.cleanup import cleanup
 with SessionLocal.begin() as db:db.get(MediaFile,UUID(media['media_id'])).created_at=now()-timedelta(days=2)
 cleanup();assert admin.get(media['url']).status_code==404

def test_admin_idle_expiry(admin):
 raw=admin.cookies['devup_admin'];fake=TestClient(app);fake.cookies.set('devup_session',raw)
 assert fake.get('/api/auth/me').json()['user'] is None
 with SessionLocal.begin() as db:db.scalar(select(ServerSession).where(ServerSession.token_hash==digest(raw))).expires_at=now()-timedelta(minutes=1)
 assert admin.get('/api/admin/services').status_code==401

def test_concurrent_manual_claim(admin,isolated_db):
 from concurrent.futures import ThreadPoolExecutor
 p=guest(TestClient(app));c=TestClient(app);auth(c,isolated_db)
 user_id=admin.get('/api/admin/users').json()['items'][0]['id']
 def run(_):return post(admin,f"/admin/requests/{p['number']}/claim",{'user_id':user_id}).status_code
 with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,range(2)))
 assert results.count(200)==1 and results.count(409)==1

def test_portfolio_limits_single_cover_and_order(admin):
 one=upload(admin).json();two=upload(admin).json()
 base={'title':'Работа','kind':'app','description':'','status':'draft'}
 double={**base,'images':[{'media_id':one['media_id'],'is_cover':True},{'media_id':two['media_id'],'is_cover':True}]}
 assert post(admin,'/admin/portfolio',double).status_code==422
 assert post(admin,'/admin/portfolio',{**base,'images':[{'media_id':one['media_id']}]*13}).status_code==422
 p=post(admin,'/admin/portfolio',{**base,'images':[{'media_id':one['media_id']},{'media_id':two['media_id']}]}).json()
 with pytest.raises(IntegrityError):
  with SessionLocal.begin() as db:
   for im in db.scalars(select(PortfolioImage).where(PortfolioImage.project_id==UUID(p['id']))):im.is_cover=True
 second=post(admin,'/admin/portfolio',{**base,'title':'Вторая','images':[]}).json()
 assert call(admin,'PUT','/admin/portfolio/order',{'ids':[second['id'],p['id']]}).status_code==200
 assert admin.get('/api/admin/portfolio').json()[0]['id']==second['id']
 assert call(admin,'PUT','/admin/portfolio/order',{'ids':[p['id']]}).status_code==400

def test_pagination_search_and_unknown_guard(admin):
 with SessionLocal.begin() as db:
  for i in range(23):db.add(ProjectRequest(project_type='site',status='new' if i<21 else 'done',submitted_ip='test'))
 one=admin.get('/api/admin/requests?status=new&page=1').json();two=admin.get('/api/admin/requests?status=new&page=2').json()
 assert one['total']==21 and len(one['items'])==20 and len(two['items'])==1
 number=one['items'][0]['number'];assert admin.get('/api/admin/requests?q=DEVUP-'+str(number)).json()['total']==1
 assert TestClient(app).get('/api/admin/unknown').status_code==401

def test_animation_and_metadata(admin):
 b=BytesIO();frames=[Image.new('RGB',(20,20),c) for c in ['red','green']];frames[0].save(b,format='WEBP',save_all=True,append_images=frames[1:],duration=100,loop=0)
 assert upload(admin,b.getvalue(),'movie.webp').status_code==400
 b=BytesIO();image=Image.new('RGB',(100,60),'blue');exif=Image.Exif();exif[270]='private metadata';exif[274]=6;image.save(b,format='JPEG',exif=exif)
 result=upload(admin,b.getvalue(),'original-secret-name.jpg').json()
 assert 'original-secret-name' not in result['url']
 with Image.open(BytesIO(admin.get(result['url']).content)) as clean:assert not clean.getexif() and clean.height>clean.width


def test_review_moderation_hides_drafts_and_deletes_published_reviews(client, isolated_db):
    from models import Review

    with SessionLocal.begin() as db:
        service_id = db.scalar(select(Service.id).where(Service.code == 'site'))
        published = Review(service_id=service_id, author_name='Анна', rating=5,
                           body='Отлично', status='published')
        pending = Review(service_id=service_id, author_name='Илья', rating=4, body='Спасибо')
        db.add_all([published, pending])
        db.flush()
        review_id = str(published.id)
    path = '/api/admin/reviews'
    assert client.get(path).status_code == 401
    assert client.delete(path + '/' + review_id, headers=HEAD).status_code == 401
    assert [row['id'] for row in client.get('/api/reviews').json()] == [review_id]
    admin_login(client, isolated_db)
    assert {row['status'] for row in client.get(path).json()['items']} == {'published', 'pending'}
    assert client.request('DELETE', path + '/' + review_id, json={}, headers=HEAD).status_code == 200
    assert client.get('/api/reviews').json() == []
    assert len(client.get(path).json()['items']) == 1
