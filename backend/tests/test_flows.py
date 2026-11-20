from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from uuid import UUID
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.db import SessionLocal
from app.models import AuthChallenge,RequestClaimCode,RequestAccessToken,RequestClaimEvent,RateLimitHit
from app.security import now,normalize_code,secret_hash,matches
HEAD={'X-Requested-With':'devup'}
def post(c,path,data):return c.post('/api'+path,json=data,headers=HEAD)
def guest(c,contacts=None):
 r=post(c,'/requests',{'project_type':'site','company_text':'Задача','blocks':[{'kind':'hero','title':'Главная','description':''}],'contacts':contacts or [{'kind':'telegram','value':'@example'}]})
 assert r.status_code==200,r.text
 return r.json()
def register(c,messages,email='person@example.com',extra=None):
 result=post(c,'/auth/register',{'email':email,'password':'A-long-password-123',**(extra or {})})
 assert result.status_code==200,result.text
 code=next(x[2]['code'] for x in reversed(messages) if x[0]==email and x[1]=='code')
 return result.json()['challenge_id'],code
def auth(c,messages,email='person@example.com'):
 challenge,code=register(c,messages,email)
 r=post(c,'/auth/verify',{'challenge_id':challenge,'code':code});assert r.status_code==200,r.text
 return r.json()
def test_registration_and_session(client,isolated_db):
 auth(client,isolated_db)
 assert client.get('/api/auth/me').json()['user']['email']=='person@example.com'
 assert client.get('/api/requests/mine').json()==[]
 assert 'devup_session' in client.cookies
 assert post(client,'/auth/logout',{}).status_code==200
 assert client.get('/api/auth/me').json()['user'] is None

def test_wrong_codes_consumed(client,isolated_db):
 challenge,code=register(client,isolated_db)
 wrong='000001' if code!='000001' else '000002'
 for _ in range(5):assert post(client,'/auth/verify',{'challenge_id':challenge,'code':wrong}).status_code==400
 assert post(client,'/auth/verify',{'challenge_id':challenge,'code':code}).status_code==400

def test_resend_cooldown_and_invalidation(client,isolated_db):
 challenge,old=register(client,isolated_db)
 assert post(client,'/auth/resend',{'challenge_id':challenge}).status_code==429
 with SessionLocal.begin() as db:
  db.get(AuthChallenge,UUID(challenge)).last_sent_at=now()-timedelta(seconds=61)
  for row in db.scalars(select(RateLimitHit)):row.created_at=now()-timedelta(seconds=61)
 r=post(client,'/auth/resend',{'challenge_id':challenge});assert r.status_code==200,r.text
 new=isolated_db[-1][2]['code']
 if old!=new:assert post(client,'/auth/verify',{'challenge_id':challenge,'code':old}).status_code==400
 assert post(client,'/auth/verify',{'challenge_id':challenge,'code':new}).status_code==200

def test_login_uniform_and_limits(client):
 for _ in range(5):assert post(client,'/auth/login',{'email':'unknown@example.com','password':'bad-password-123'}).status_code==400
 assert post(client,'/auth/login',{'email':'unknown@example.com','password':'bad-password-123'}).status_code==429

def test_guest_claim_same_browser_and_hashes(client,isolated_db):
 p=guest(client,[{'kind':'email','value':'guest@example.com'}])
 assert len(normalize_code(p['claim_code']))==12 and 'devup_guest' in client.cookies
 with SessionLocal() as db:
  row=db.scalar(select(RequestClaimCode));assert row.code_hash!=p['claim_code'] and len(row.code_hash)==64
  assert db.scalar(select(RequestAccessToken)).token_hash not in client.cookies['devup_guest']
 assert isolated_db[-1][1]=='request'
 assert len(auth(client,isolated_db)['claimable'])==1
 assert post(client,'/claims/apply',{'numbers':[p['number']]}).json()['claimed']==[p['number']]
 assert len(client.get('/api/requests/mine').json())==1
 assert TestClient(app).get(f"/api/requests/{p['number']}").status_code==404

def test_registration_claim_and_pair(client,isolated_db):
 p=guest(client)
 assert post(client,'/auth/register',{'email':'person@example.com','password':'A-long-password-123','number':str(p['number'])}).status_code==422
 challenge,code=register(client,isolated_db,extra={'number':p['display_number'],'claim_code':p['claim_code']})
 assert post(client,'/auth/verify',{'challenge_id':challenge,'code':code}).json()['registration_claimed']
 with SessionLocal() as db:assert db.scalar(select(RequestClaimEvent)).method=='registration_code'

def test_authenticated_submit_and_details(client,isolated_db):
 auth(client,isolated_db);p=guest(client);assert p['claim_code'] is None
 d=client.get(f"/api/requests/{p['number']}").json()
 assert d['blocks'][0]['kind']=='hero' and d['history'][0]['to_status']=='new'
 with SessionLocal() as db:assert db.scalar(select(RequestClaimEvent)).method=='auto_submit'

def test_email_discovery_and_manual_claim(client,isolated_db):
 p=guest(TestClient(app),[{'kind':'email','value':'person@example.com'}]);auth(client,isolated_db)
 assert [x['number'] for x in post(client,'/claims/discover',{}).json()]==[p['number']]
 data={'number':p['display_number'],'claim_code':p['claim_code'].lower().replace('-',' ')}
 assert post(client,'/claims/by-code',data).status_code==200
 assert post(client,'/claims/by-code',data).status_code==400

def test_claim_wrong_attempts(client,isolated_db):
 p=guest(TestClient(app));auth(client,isolated_db)
 for _ in range(5):assert post(client,'/claims/by-code',{'number':str(p['number']),'claim_code':'INVALID'}).status_code==400
 assert post(client,'/claims/by-code',{'number':str(p['number']),'claim_code':p['claim_code']}).status_code==429

def test_concurrent_claim_exactly_once(client,isolated_db):
 p=guest(TestClient(app));a=TestClient(app);b=TestClient(app)
 auth(a,isolated_db,'first@example.com');auth(b,isolated_db,'second@example.com')
 def attempt(c):return post(c,'/claims/by-code',{'number':str(p['number']),'claim_code':p['claim_code']}).status_code
 with ThreadPoolExecutor(max_workers=2) as pool:codes=list(pool.map(attempt,[a,b]))
 assert codes.count(200)==1
 with SessionLocal() as db:assert len(db.scalars(select(RequestClaimEvent)).all())==1

def test_csrf_and_validation(client):
 assert client.post('/api/requests',json={}).status_code==403
 data={'project_type':'site','blocks':[{'kind':'unknown','title':'X'}],'contacts':[{'kind':'telegram','value':'test'}]}
 assert post(client,'/requests',data).status_code==422
 data['blocks']=[{'kind':'hero','title':'X'},{'kind':'hero','title':'Y'}]
 assert post(client,'/requests',data).status_code==422

def test_request_limits(client):
 for _ in range(5):guest(client)
 r=post(client,'/requests',{'project_type':'site','blocks':[],'contacts':[{'kind':'telegram','value':'test'}]})
 assert r.status_code==429 and 'retry-after' in r.headers

def test_email_failure_reported(client,monkeypatch):
 from app.mail import SMTPSender
 def bad(*args):raise RuntimeError('sensitive error must not leak')
 monkeypatch.setattr(SMTPSender,'send',bad)
 p=guest(client,[{'kind':'email','value':'person@example.com'}])
 r=client.get('/api/mail/'+p['mail_id']).json()
 assert r['status']=='failed' and 'sensitive' not in r['message']

def test_secret_normalization_and_context():
 assert normalize_code('abcd-efgh ijkl')=='ABCDEFGHIJKL'
 value=secret_hash('123456','challenge-a')
 assert matches('123456',value,'challenge-a') and not matches('123456',value,'challenge-b')
def test_login_requires_new_code_and_rotates_session(client,isolated_db):
 auth(client,isolated_db)
 previous=client.cookies['devup_session']
 with SessionLocal.begin() as db:
  for row in db.scalars(select(RateLimitHit)):row.created_at=now()-timedelta(seconds=61)
 result=post(client,'/auth/login',{'email':'person@example.com','password':'A-long-password-123'})
 assert result.status_code==200
 code=isolated_db[-1][2]['code']
 assert post(client,'/auth/verify',{'challenge_id':result.json()['challenge_id'],'code':code}).status_code==200
 assert client.cookies['devup_session']!=previous
 assert post(client,'/auth/verify',{'challenge_id':result.json()['challenge_id'],'code':code}).status_code==400

def test_expired_code_and_resend_max(client,isolated_db):
 challenge,code=register(client,isolated_db)
 with SessionLocal.begin() as db:db.get(AuthChallenge,UUID(challenge)).resend_count=5
 assert post(client,'/auth/resend',{'challenge_id':challenge}).status_code==400
 with SessionLocal.begin() as db:db.get(AuthChallenge,UUID(challenge)).expires_at=now()-timedelta(seconds=1)
 assert post(client,'/auth/verify',{'challenge_id':challenge,'code':code}).status_code==400

def test_telegram_does_not_discover(client,isolated_db):
 guest(TestClient(app),[{'kind':'telegram','value':'person'}])
 auth(client,isolated_db)
 assert post(client,'/claims/discover',{}).json()==[]

def test_registration_cooldown_and_existing_response(client,isolated_db):
 auth(client,isolated_db)
 assert post(client,'/auth/register',{'email':'person@example.com','password':'A-long-password-123'}).status_code==429
 with SessionLocal.begin() as db:
  for row in db.scalars(select(RateLimitHit)):row.created_at=now()-timedelta(seconds=61)
 response=post(client,'/auth/register',{'email':'person@example.com','password':'A-long-password-123'})
 assert response.status_code==200 and 'challenge_id' in response.json()
 assert isolated_db[-1][1]=='existing'
def test_status_cli_and_cleanup(client,isolated_db):
 import subprocess,sys
 from pathlib import Path
 from app.cleanup import cleanup
 from models import User
 auth(client,isolated_db);p=guest(client)
 result=subprocess.run([sys.executable,'manage.py','set-status',str(p['number']),'in_progress','--comment','Начали работу'],cwd=Path(__file__).resolve().parents[1],capture_output=True)
 assert result.returncode==0
 d=client.get(f"/api/requests/{p['number']}").json()
 assert d['status']=='in_progress' and d['history'][-1]['to_status']=='in_progress'
 with SessionLocal.begin() as db:
  stale=User(email='stale@example.com',password_hash='unused',display_name='',created_at=now()-timedelta(days=2));db.add(stale);db.flush();user_id=stale.id
 cleanup()
 with SessionLocal() as db:assert db.get(User,user_id) is None

def test_empty_contacts_only_reuse_signed_in_clients_data(client, isolated_db):
 from fastapi.testclient import TestClient
 from app.main import app
 payload={'project_type':'site','blocks':[],'contacts':[]}
 assert post(client,'/requests',payload).status_code==422
 auth(client,isolated_db)
 assert post(client,'/requests',{**payload,'contacts':[{'kind':'telegram','value':'@saved'}]}).status_code==200
 outsider=TestClient(app)
 guest(outsider,[{'kind':'vk','value':'@unrelated'}])
 result=post(client,'/requests',payload)
 assert result.status_code==200,result.text
 details=client.get('/api/requests/'+str(result.json()['number'])).json()
 assert {c['kind']:c['value'] for c in details['contacts']}=={'email':'person@example.com','telegram':'@saved'}
 explicit=post(client,'/requests',{**payload,'contacts':[{'kind':'vk','value':'@explicit'}]})
 details=client.get('/api/requests/'+str(explicit.json()['number'])).json()
 assert details['contacts']==[{'kind':'vk','value':'@explicit'}]
