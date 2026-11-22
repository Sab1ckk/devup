import asyncio
from contextlib import asynccontextmanager,suppress
from pathlib import Path
from fastapi import FastAPI,HTTPException,Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse,JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from app.api import router
from app.chat import client as chat_client, admin as chat_admin
from app.admin_auth import router as admin_auth_router,current_admin
from app.admin_api import router as admin_router,public as catalog_router
from app.storage import storage
from app.db import SessionLocal,engine
from app.config import settings
from app.security import now
from app.cleanup import cleanup
from models import SiteContent

async def maintenance():
    while True:
        try: await asyncio.to_thread(cleanup)
        except Exception: pass  # Never log SQL parameters or secret payloads.
        await asyncio.sleep(3600)

@asynccontextmanager
async def lifespan(app):
    task=asyncio.create_task(maintenance())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError): await task
    engine.dispose()

app=FastAPI(title='DevUp API',lifespan=lifespan)

@app.middleware('http')
async def guard(request:Request,call_next):
    if request.url.path.startswith('/api'):
        if request.url.path.startswith('/api/admin/') and request.url.path not in ('/api/admin/auth/login','/api/admin/auth/verify','/api/admin/auth/resend'):
            def check_admin():
                with SessionLocal() as db:
                    current_admin(db,request);db.commit()
            try:await asyncio.to_thread(check_admin)
            except HTTPException as exc:return JSONResponse(exc.detail,status_code=exc.status_code)
        if request.method in ('POST','DELETE','PATCH','PUT'):
            upload=request.method=='POST' and request.url.path=='/api/admin/media'
            content_type=request.headers.get('content-type','').split(';')[0]
            if request.headers.get('x-requested-with')!='devup' or (content_type!='application/json' and not (upload and content_type=='multipart/form-data')):
                return JSONResponse({'code':'csrf','message':'Требуется обновление страницы и повторная отправка.'},status_code=403)
            if upload:
                try:
                    with SessionLocal() as db:
                        current_admin(db,request);db.commit()
                except HTTPException as exc:return JSONResponse(exc.detail,status_code=exc.status_code)
            limit=settings().max_upload_bytes+65536 if upload else 131072
            if len(await request.body())>limit:
                return JSONResponse({'code':'too_large','message':'Слишком много данных.'},status_code=413)
        response=await call_next(request)
        if hasattr(request.state,'session_expires') and request.url.path!='/api/auth/logout' and response.status_code<400:
            response.set_cookie('devup_session',request.cookies.get('devup_session',''),max_age=max(0,int((request.state.session_expires-now()).total_seconds())),httponly=True,secure=settings().cookie_secure,samesite='lax',path='/')
        if hasattr(request.state,'admin_expires') and request.url.path!='/api/admin/auth/logout' and response.status_code<400:
            response.set_cookie('devup_admin',request.cookies.get('devup_admin',''),max_age=max(0,int((request.state.admin_expires-now()).total_seconds())),httponly=True,secure=settings().cookie_secure,samesite='strict',path='/api')
        if 'Cache-Control' not in response.headers:response.headers['Cache-Control']='no-store'
        response.headers['X-Content-Type-Options']='nosniff'
        return response
    response=await call_next(request)
    if request.url.path.startswith('/admin'):response.headers['X-Robots-Tag']='noindex'
    return response

@app.exception_handler(HTTPException)
async def http_error(request,exc):
    detail=exc.detail if isinstance(exc.detail,dict) else {'code':'error','message':str(exc.detail)}
    return JSONResponse(detail,status_code=exc.status_code,headers=exc.headers)

@app.exception_handler(RequestValidationError)
async def validation_error(request,exc):
    errors=[{'field':'.'.join(str(x) for x in e['loc'][1:]),'message':'Значение или длина поля указаны неверно.'} for e in exc.errors()]
    return JSONResponse({'code':'validation','message':'Поля заполнены неверно.','field':errors[0]['field'] if errors else None,'errors':errors},status_code=422)

@app.exception_handler(Exception)
async def unexpected(request,exc):
    return JSONResponse({'code':'server_error','message':'Не удалось выполнить запрос. Повторная попытка будет доступна позднее.'},status_code=500)

app.include_router(admin_auth_router)
app.include_router(admin_router)
app.include_router(catalog_router)
app.include_router(chat_client)
app.include_router(chat_admin)
app.include_router(router)

class MediaFiles(StaticFiles):
    async def get_response(self,path,scope):
        response=await super().get_response(path,scope)
        response.headers['X-Content-Type-Options']='nosniff'
        response.headers['Cache-Control']='public, max-age=31536000, immutable'
        return response

app.mount(settings().media_url_prefix,MediaFiles(directory=storage().root),name='media')

@app.get('/api/site-content')
def site_content():
    with SessionLocal() as db:
        rows=db.scalars(select(SiteContent).where(SiteContent.key.in_(['about','terms','privacy','contacts'])))
        return {r.key:r.value for r in rows}

@app.get('/api/{path:path}',include_in_schema=False)
def missing_api(path:str): raise HTTPException(404,{'code':'not_found','message':'API не найден.'})

frontend_dist=Path(__file__).resolve().parents[2]/'frontend/dist'
if (frontend_dist/'assets').is_dir(): app.mount('/assets',StaticFiles(directory=frontend_dist/'assets'),name='assets')
@app.get('/{path:path}',include_in_schema=False)
def spa(path:str):
    if not (frontend_dist/'index.html').is_file(): raise HTTPException(503,'Сначала собери frontend: npm run build')
    target=(frontend_dist/path).resolve()
    if target.is_relative_to(frontend_dist.resolve()) and target.is_file() and not any(part.startswith('.') for part in Path(path).parts):
        return FileResponse(target)
    return FileResponse(frontend_dist/'index.html')
