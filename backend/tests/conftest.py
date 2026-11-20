import os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from dotenv import dotenv_values
from sqlalchemy.engine import make_url
config=dotenv_values(Path(__file__).resolve().parents[2]/'.env')
url=os.environ.get('TEST_DATABASE_URL') or make_url(config['DATABASE_URL']).set(database='devup_test').render_as_string(hide_password=False)
assert make_url(url).database=='devup_test'
os.environ['DATABASE_URL']=url
os.environ['SECRET_KEY']='test-only-secret-key-at-least-32-characters'
os.environ['MAIL_BACKEND']='smtp'
import tempfile
_media_tmp=tempfile.TemporaryDirectory(prefix='devup-admin-test-')
os.environ['MEDIA_ROOT']=_media_tmp.name
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.db import engine
from support import seed_services,seed_manager
from app.mail import SMTPSender
@pytest.fixture(autouse=True)
def isolated_db(monkeypatch):
 assert engine.url.database=='devup_test'
 with engine.begin() as db:
  tables=db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename!='alembic_version'")).scalars().all()
  db.execute(text('TRUNCATE '+','.join('"'+t+'"' for t in tables)+' RESTART IDENTITY CASCADE'))
  seed_services(db)
  seed_manager(db)
 messages=[]
 monkeypatch.setattr(SMTPSender,'send',lambda self,to,template,context: messages.append((to,template,context)))
 yield messages
@pytest.fixture
def client():return TestClient(app)
