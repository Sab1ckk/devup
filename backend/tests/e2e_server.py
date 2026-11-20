"""Isolated browser-test host. Never import from production entry points."""
import os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from dotenv import dotenv_values
from sqlalchemy.engine import make_url
cfg=dotenv_values(Path(__file__).resolve().parents[2]/'.env')
url=make_url(cfg['DATABASE_URL']).set(database='devup_test')
os.environ['DATABASE_URL']=url.render_as_string(hide_password=False)
os.environ['SECRET_KEY']='browser-test-only-secret-at-least-32-characters'
os.environ['MAIL_BACKEND']='smtp'
import tempfile
_media_tmp=tempfile.TemporaryDirectory(prefix='devup-admin-test-')
os.environ['MEDIA_ROOT']=_media_tmp.name
from app.main import app
from app.mail import SMTPSender
from app.db import engine
from support import seed_services,seed_manager
from sqlalchemy import text
from fastapi.staticfiles import StaticFiles
assert engine.url.database=='devup_test'
with engine.begin() as db:
 tables=db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename!='alembic_version'")).scalars().all()
 db.execute(text('TRUNCATE '+','.join('"'+t+'"' for t in tables)+' RESTART IDENTITY CASCADE'))
 seed_services(db)
 seed_manager(db)
messages=[]
def capture(self,to,template,context):messages.append({'to':to,'template':template,**context})
SMTPSender.send=capture
# Place test routes before the SPA catch-all; these routes do not exist in app.main.
from fastapi import APIRouter
router=APIRouter()
@router.get('/__test/mail')
def mail():return messages
@router.post('/__test/reset')
def reset():
 with engine.begin() as db:
  tables=db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename!='alembic_version'")).scalars().all()
  db.execute(text('TRUNCATE '+','.join('"'+t+'"' for t in tables)+' RESTART IDENTITY CASCADE'))
  seed_services(db)
  seed_manager(db)
 messages.clear();return {'ok':True}
app.router.routes[0:0]=router.routes
app.router.routes.insert(0,__import__('starlette.routing',fromlist=['Mount']).Mount('/template',app=StaticFiles(directory=Path(__file__).resolve().parents[2]/'template',html=True)))
if __name__=='__main__':
 import uvicorn
 uvicorn.run(app,host='127.0.0.1',port=8011,access_log=False,log_level='warning')
