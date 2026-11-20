from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(settings().sync_url, pool_pre_ping=True, hide_parameters=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)

def db_session():
    with SessionLocal() as db:
        yield db
