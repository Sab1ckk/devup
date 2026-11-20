from typing import Literal,Annotated
from uuid import UUID
from pydantic import Field,StringConstraints,model_validator
from app.schemas import Schema

Kind=Literal['site','app','small','study']
Status=Literal['new','estimating','agreed','in_progress','done','cancelled']
class ServiceEdit(Schema):
    title:str=Field(min_length=1,max_length=100)
    description:str=Field(max_length=500)
    features:list[Annotated[str,StringConstraints(min_length=1,max_length=100)]]=Field(max_length=6)
    price_from:int|None=Field(default=None,ge=0,le=10000000,strict=True)
class ImageEdit(Schema):
    media_id:UUID
    alt_text:str=Field(default='',max_length=200)
    is_cover:bool=False
class PortfolioEdit(Schema):
    title:str=Field(default='',max_length=100)
    kind:Kind='site'
    description:str=Field(default='',max_length=1000)
    status:Literal['draft','published']='draft'
    images:list[ImageEdit]=Field(default_factory=list,max_length=12)
    @model_validator(mode='after')
    def valid(self):
        if len({x.media_id for x in self.images})!=len(self.images):raise ValueError('Картинки не должны повторяться')
        if sum(x.is_cover for x in self.images)>1:raise ValueError('Выбери одну обложку')
        if self.status=='published' and (not self.title.strip() or not self.images):raise ValueError('Для публикации нужны название и картинки')
        return self
class PortfolioOrder(Schema):
    ids:list[UUID]=Field(max_length=1000)
class ChangeStatus(Schema):
    status:Status
    comment:str=Field(default='',max_length=500)
class ManualClaim(Schema):
    user_id:UUID
