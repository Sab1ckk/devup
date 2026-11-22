from datetime import timedelta
from fastapi import APIRouter,Depends,Request,Response,BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import Field
from models import User
from app.models import ServerSession,AuthChallenge
from app.db import db_session
from app.config import settings
from app.security import now,digest,token,check_password,DUMMY_HASH,matches,verification_code,secret_hash
from app.schemas import Schema,Verify,ChallengeInput
from app.rate_limit import hit,fail
from app.api import ip,agent,mail_limits,new_challenge
from app.mail import enqueue

router=APIRouter(prefix='/api/admin/auth')
DB=Depends(db_session)
class Login(Schema):
    username:str=Field(min_length=1,max_length=200)
    password:str=Field(min_length=1,max_length=128)

def admin_identity(user):return {'id':str(user.id),'username':user.username}
def current_admin(db,req,required=True):
    raw=req.cookies.get('devup_admin','');at=now();cfg=settings()
    session=db.scalar(select(ServerSession).where(ServerSession.token_hash==digest(raw),ServerSession.kind=='admin',ServerSession.revoked_at.is_(None),ServerSession.expires_at>at,ServerSession.created_at>at-timedelta(hours=cfg.admin_session_max_hours))) if raw else None
    user=db.get(User,session.user_id) if session else None
    if user and (user.role!='manager' or not user.username or not user.is_active or not user.email_verified_at):user=None
    if not user:
        if required:fail(401,'admin_unauthorized','Сессия истекла. Требуется авторизация в админ-панели.')
        return None,None
    session.expires_at=min(at+timedelta(minutes=cfg.admin_session_idle_minutes),session.created_at+timedelta(hours=cfg.admin_session_max_hours));session.last_seen_at=at
    req.state.admin_expires=session.expires_at
    return user,session

def require_admin(req:Request,db:Session=DB):
    user,_=current_admin(db,req);db.commit();return user

@router.post('/login')
def login(data:Login,req:Request,tasks:BackgroundTasks,db:Session=DB):
    cfg=settings();username=data.username.lower().strip()
    hit(db,'admin_login:ip:'+ip(req),cfg.login_ip_limit,900);hit(db,'admin_login:user:'+username,cfg.login_email_limit,900)
    user=db.scalar(select(User).where(User.username==username))
    valid=check_password(data.password,user.password_hash if user else DUMMY_HASH)
    if not valid or not user or user.role!='manager' or not user.is_active or not user.email_verified_at:fail(400,'credentials','Неверный логин или пароль.')
    mail_limits(db,user.email,req);result=new_challenge(db,user,'admin_login',None,req,tasks);db.commit();return result

@router.post('/verify')
def verify(data:Verify,req:Request,response:Response,db:Session=DB):
    c=db.scalar(select(AuthChallenge).where(AuthChallenge.id==data.challenge_id).with_for_update())
    if not c or c.purpose!='admin_login' or c.consumed_at or c.expires_at<=now() or c.attempts>=c.max_attempts:fail(400,'code_expired','Код больше не действует. Требуется повторный вход.')
    if not matches(data.code,c.code_hash,str(c.id)):
        c.attempts+=1
        if c.attempts>=c.max_attempts:c.consumed_at=now()
        left=max(0,c.max_attempts-c.attempts);db.commit();fail(400,'code_invalid',f'Неверный код. Осталось попыток: {left}.','code')
    user=db.get(User,c.user_id)
    if not user or user.role!='manager' or not user.is_active or not user.username or not user.email_verified_at:fail(400,'credentials','Неверный логин или пароль.')
    at=now();raw=token();cfg=settings();c.consumed_at=at;user.last_login_at=at
    db.add(ServerSession(user_id=user.id,kind='admin',token_hash=digest(raw),expires_at=at+timedelta(minutes=cfg.admin_session_idle_minutes),last_seen_at=at,ip=ip(req),user_agent=agent(req)))
    db.commit();response.set_cookie('devup_admin',raw,max_age=cfg.admin_session_idle_minutes*60,httponly=True,secure=cfg.cookie_secure,samesite='strict',path='/api')
    return {'admin':admin_identity(user)}

@router.post('/resend')
def resend(data:ChallengeInput,req:Request,tasks:BackgroundTasks,db:Session=DB):
    cfg=settings();c=db.scalar(select(AuthChallenge).where(AuthChallenge.id==data.challenge_id).with_for_update())
    if not c or c.purpose!='admin_login' or c.consumed_at or c.expires_at<=now() or c.resend_count>=cfg.resend_max:fail(400,'code_expired','Требуется повторный вход.')
    elapsed=(now()-c.last_sent_at).total_seconds()
    if elapsed<cfg.resend_seconds:fail(429,'resend_wait','Повторная отправка пока недоступна.',retry=max(1,int(cfg.resend_seconds-elapsed)+1))
    user=db.get(User,c.user_id)
    if user.role!='manager' or not user.is_active:fail(400,'code_expired','Требуется повторный вход.')
    mail_limits(db,user.email,req);code=verification_code();c.code_hash=secret_hash(code,str(c.id));c.resend_count+=1;c.last_sent_at=now();c.expires_at=now()+timedelta(minutes=cfg.code_minutes)
    mail_id=enqueue(db,tasks,user.email,'admin_code',{'code':code});db.commit();return {'resend_after':cfg.resend_seconds,'mail_id':mail_id}

@router.get('/me')
def me(req:Request,db:Session=DB):
    user,_=current_admin(db,req);db.commit();return {'admin':admin_identity(user)}

@router.post('/logout')
def logout(req:Request,response:Response,db:Session=DB):
    _,session=current_admin(db,req);session.revoked_at=now();db.commit();response.delete_cookie('devup_admin',path='/api');return {'ok':True}
