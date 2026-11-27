import re
from sqlalchemy import select,update
from pydantic import TypeAdapter,EmailStr
from models import User
from app.models import ServerSession,AuthChallenge
from app.db import SessionLocal
from app.security import passwords,now

def validate_manager(username,password):
    username=username.strip().lower()
    if not re.fullmatch(r'[a-z0-9._-]{3,32}',username):raise ValueError('Логин: 3–32 символа a-z, 0-9, точка, дефис или подчёркивание')
    if len(password)<8 or len(password)>128:raise ValueError('Пароль: от 8 до 128 символов')
    return username

def create_manager(username,email,password):
    username=validate_manager(username,password);email=str(TypeAdapter(EmailStr).validate_python(email.strip())).lower()
    with SessionLocal.begin() as db:
        old=db.scalar(select(User).where(User.email==email))
        if old:
            if old.role!='manager' or old.username:raise ValueError('Почта уже используется')
            old.username=username;old.password_hash=passwords.hash(password);old.email_verified_at=now();old.is_active=True
        else:db.add(User(username=username,email=email,password_hash=passwords.hash(password),display_name='',role='manager',email_verified_at=now(),is_active=True))

def reset_manager_password(username,password):
    username=validate_manager(username,password)
    with SessionLocal.begin() as db:
        user=db.scalar(select(User).where(User.username==username,User.role=='manager').with_for_update())
        if not user:raise ValueError('Менеджер не найден')
        user.password_hash=passwords.hash(password)
        db.execute(update(ServerSession).where(ServerSession.user_id==user.id).values(revoked_at=now()))
        db.execute(update(AuthChallenge).where(AuthChallenge.user_id==user.id).values(consumed_at=now()))

def validate_password(password: str) -> None:
    if len(password) < 8 or len(password) > 128:
        raise ValueError('Пароль: от 8 до 128 символов')


def reset_user_password(email: str, password: str) -> None:
    email = str(TypeAdapter(EmailStr).validate_python(email.strip())).lower()
    validate_password(password)

    with SessionLocal.begin() as db:
        user = db.scalar(
            select(User)
            .where(User.email == email)
            .with_for_update()
        )
        if not user:
            raise ValueError('Пользователь не найден')

        user.password_hash = passwords.hash(password)
        db.execute(
            update(ServerSession)
            .where(ServerSession.user_id == user.id, ServerSession.revoked_at.is_(None))
            .values(revoked_at=now())
        )
        db.execute(
            update(AuthChallenge)
            .where(AuthChallenge.user_id == user.id, AuthChallenge.consumed_at.is_(None))
            .values(consumed_at=now())
        )
