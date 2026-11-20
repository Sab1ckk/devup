from datetime import timedelta
from sqlalchemy import delete,or_,select
from app.db import SessionLocal
from app.models import AuthChallenge,ServerSession,RequestAccessToken,RateLimitHit
from models import User,MediaFile,PortfolioImage
from app.storage import delete_files
from app.security import now

def cleanup():
    at=now()
    with SessionLocal.begin() as db:
        db.execute(delete(AuthChallenge).where(AuthChallenge.expires_at<at))
        db.execute(delete(ServerSession).where(or_(ServerSession.expires_at<at,ServerSession.revoked_at.is_not(None))))
        db.execute(delete(RequestAccessToken).where(or_(RequestAccessToken.expires_at<at,RequestAccessToken.revoked_at.is_not(None))))
        db.execute(delete(User).where(User.email_verified_at.is_(None),User.created_at<at-timedelta(hours=24)))
        db.execute(delete(RateLimitHit).where(RateLimitHit.created_at<at-timedelta(days=1)))
        medias=db.scalars(select(MediaFile).where(MediaFile.created_at<at-timedelta(hours=24),~MediaFile.id.in_(select(PortfolioImage.media_id).where(PortfolioImage.media_id.is_not(None)))).with_for_update(skip_locked=True)).all()
        keys=[key for m in medias for key in (m.key_full,m.key_thumb)]
        for m in medias:db.delete(m)
    delete_files(keys)
