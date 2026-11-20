from datetime import timedelta
from sqlalchemy import select,func,text
from fastapi import HTTPException
from app.models import RateLimitHit
from app.security import now,digest


def fail(status,code,message,field=None,retry=None):
    detail={'code':code,'message':message}
    if field: detail['field']=field
    raise HTTPException(status,detail,headers={'Retry-After':str(retry)} if retry else None)


def hit(db,key,limit,seconds):
    # Independent transaction persists failed attempts; advisory lock serializes workers.
    from app.db import SessionLocal
    safe_key=digest(key)
    with SessionLocal.begin() as limits:
        limits.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))'),{'key':safe_key})
        cutoff=now()-timedelta(seconds=seconds)
        count=limits.scalar(select(func.count()).select_from(RateLimitHit).where(RateLimitHit.key==safe_key,RateLimitHit.created_at>cutoff))
        if count>=limit: fail(429,'rate_limit','Слишком много попыток. Попробуй позже.',retry=seconds)
        limits.add(RateLimitHit(key=safe_key))
