import json,re
from pathlib import Path
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, EmailStr, field_validator, model_validator

BLOCK_KINDS = {x['code']: x for x in json.loads((Path(__file__).resolve().parents[2]/'shared/block-kinds.json').read_text(encoding='utf-8'))}
class Schema(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class Credentials(Schema):
    email: EmailStr
    password: str = Field(min_length=10,max_length=128)
    @field_validator('email')
    @classmethod
    def normalized(cls,v): return str(v).strip().lower()

class Register(Credentials):
    number: str = Field(default='',max_length=40)
    claim_code: str = Field(default='',max_length=100)
    @model_validator(mode='after')
    def pair(self):
        if bool(self.number) != bool(self.claim_code): raise ValueError('Номер заявки и код должны быть указаны вместе либо оба поля должны быть оставлены пустыми')
        return self

class ChallengeInput(Schema):
    challenge_id: UUID
class Verify(ChallengeInput):
    code: str = Field(pattern=r'^\d{6}$')
class ByCode(Schema):
    number: str = Field(min_length=1,max_length=40)
    claim_code: str = Field(min_length=1,max_length=100)
class Apply(Schema):
    numbers: list[int] = Field(min_length=1,max_length=10)
class Block(Schema):
    kind: str
    title: str = Field(min_length=1,max_length=100)
    description: str = Field(default='',max_length=2000)
    @field_validator('kind')
    @classmethod
    def kind_known(cls,v):
        if v not in BLOCK_KINDS: raise ValueError('Неизвестный блок')
        return v
class Contact(Schema):
    kind: Literal['email','telegram','vk']
    value: str = Field(min_length=1,max_length=320)
    @model_validator(mode='after')
    def validate_value(self):
        if self.kind=='email':
            from pydantic import TypeAdapter
            self.value=str(TypeAdapter(EmailStr).validate_python(self.value)).lower()
        elif not re.fullmatch(r'(?:https?://)?(?:www\.)?(?:(?:t\.me|telegram\.me|vk\.com)/)?@?[\w.\-]+/?',self.value):
            raise ValueError('Должно быть указано имя пользователя или ссылка на профиль')
        return self
class CreateRequest(Schema):
    project_type: Literal['site','app','small','study']
    company_text: str = Field(default='',max_length=4000)
    wishes_text: str = Field(default='',max_length=4000)
    design_text: str = Field(default='',max_length=4000)
    deadline_text: str = Field(default='',max_length=4000)
    budget_text: str = Field(default='',max_length=4000)
    blocks: list[Block] = Field(max_length=30)
    contacts: list[Contact] = Field(max_length=3)
    website: str = Field(default='',max_length=0)
    @model_validator(mode='after')
    def unique(self):
        kinds=[b.kind for b in self.blocks if BLOCK_KINDS[b.kind]['unique']]
        if len(kinds)!=len(set(kinds)): raise ValueError('Этот блок можно добавить только один раз')
        contacts=[c.kind for c in self.contacts]
        if len(contacts)!=len(set(contacts)): raise ValueError('Контакты не должны повторяться')
        return self
