# Backward-compatible imports for local tooling. Runtime uses synchronous psycopg.
from app.config import settings
from app.db import engine, SessionLocal, db_session

def database_url():
    return settings().sync_url

def session_factory():
    return engine, SessionLocal
