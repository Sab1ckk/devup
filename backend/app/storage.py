from pathlib import Path
from typing import Protocol
from io import BytesIO
from uuid import uuid4
import hashlib,logging,warnings
from PIL import Image,ImageOps,UnidentifiedImageError
from app.config import settings,ROOT
from app.rate_limit import fail

class FileStorage(Protocol):
    def save(self,key:str,data:bytes):...
    def delete(self,key:str):...
    def url(self,key:str)->str:...

class LocalFileStorage:
    def __init__(self):
        root=settings().media_root
        self.root=(root if root.is_absolute() else ROOT/root).resolve()
        self.root.mkdir(parents=True,exist_ok=True)
    def path(self,key):
        target=(self.root/key).resolve()
        if Path(key).name!=key or not target.is_relative_to(self.root):raise ValueError('Invalid storage key')
        return target
    def save(self,key,data):self.path(key).write_bytes(data)
    def delete(self,key):self.path(key).unlink(missing_ok=True)
    def url(self,key):return settings().media_url_prefix.rstrip('/')+'/'+key

def storage():
    if settings().file_storage_backend!='local':raise RuntimeError('Unknown storage implementation')
    return LocalFileStorage()

def delete_files(keys):
    store=storage()
    for key in keys:
        try:store.delete(key)
        except OSError:logging.getLogger(__name__).warning('Unable to delete a media file')

def process_image(data):
    cfg=settings()
    if not data or len(data)>cfg.max_upload_bytes:fail(400,'upload_size','Размер картинки — не больше 5 МБ.','file')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error',Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format not in ('PNG','JPEG','WEBP') or getattr(image,'n_frames',1)!=1:fail(400,'upload_format','Нужна статичная картинка PNG, JPEG или WebP.','file')
                if image.width>cfg.max_image_side or image.height>cfg.max_image_side:fail(400,'upload_dimensions','Слишком большая картинка. Максимум 8000 × 8000.','file')
                image.verify()
            with Image.open(BytesIO(data)) as original:
                image=ImageOps.exif_transpose(original)
                image=image.convert('RGBA' if 'A' in image.getbands() or 'transparency' in image.info else 'RGB')
                image.thumbnail((1600,1600),Image.Resampling.LANCZOS)
                clean=Image.new(image.mode,image.size);clean.paste(image)
                full=BytesIO();clean.save(full,format='WEBP',quality=85)
                thumb=clean.copy();thumb.thumbnail((640,1600),Image.Resampling.LANCZOS)
                thumbnail=BytesIO();thumb.save(thumbnail,format='WEBP',quality=80)
                value=full.getvalue();name=uuid4().hex
                return {'key_full':name+'.webp','key_thumb':name+'-thumb.webp','mime':'image/webp','width':clean.width,'height':clean.height,'size_bytes':len(value),'sha256':hashlib.sha256(value).hexdigest()},value,thumbnail.getvalue()
    except (UnidentifiedImageError,OSError,ValueError,Image.DecompressionBombError,Image.DecompressionBombWarning):
        fail(400,'upload_format','Не удалось прочитать картинку. Нужен PNG, JPEG или WebP.','file')
