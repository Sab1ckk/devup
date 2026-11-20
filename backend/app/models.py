from datetime import datetime
from uuid import UUID
from sqlalchemy import BigInteger, String, Text, Integer, DateTime, ForeignKey, CheckConstraint, UniqueConstraint, Index, Identity, text
from sqlalchemy.orm import Mapped, mapped_column
from models import Base, Entity, User
from app.schemas import BLOCK_KINDS
BLOCK_KIND_CHECK = "kind IN (" + ",".join(repr(k) for k in BLOCK_KINDS) + ")"

STATUSES = ('new','estimating','agreed','in_progress','done','cancelled')

class ProjectRequest(Entity, Base):
    __tablename__ = 'requests'
    number: Mapped[int] = mapped_column(Integer, Identity(start=1001), unique=True)
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), index=True)
    project_type: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), server_default='new', index=True)
    company_text: Mapped[str] = mapped_column(Text, default='')
    wishes_text: Mapped[str] = mapped_column(Text, default='')
    design_text: Mapped[str] = mapped_column(Text, default='')
    deadline_text: Mapped[str] = mapped_column(Text, default='')
    budget_text: Mapped[str] = mapped_column(Text, default='')
    submitted_ip: Mapped[str] = mapped_column(String(100))
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (CheckConstraint("project_type IN ('site','app','small','study')", name='project_type'), CheckConstraint("status IN ('new','estimating','agreed','in_progress','done','cancelled')", name='status'))

class AuthChallenge(Entity, Base):
    __tablename__ = 'auth_challenges'
    user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    purpose: Mapped[str] = mapped_column(String(20))
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    resend_count: Mapped[int] = mapped_column(Integer, default=0)
    last_sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pending_request_id: Mapped[UUID | None] = mapped_column(ForeignKey('requests.id', ondelete='SET NULL'))
    ip: Mapped[str] = mapped_column(String(100))
    user_agent: Mapped[str] = mapped_column(String(500))
    __table_args__ = (Index('ix_auth_challenges_user_created', 'user_id','created_at'), CheckConstraint("purpose IN ('register','login','admin_login')",name='purpose'), CheckConstraint('attempts >= 0 AND resend_count >= 0',name='counts'))

class ServerSession(Entity, Base):
    __tablename__ = 'sessions'
    kind: Mapped[str] = mapped_column(String(10),server_default='client')
    __table_args__ = (CheckConstraint("kind IN ('client','admin')",name='kind'),Index('ix_sessions_kind_user','kind','user_id'))
    user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True)
    token_hash: Mapped[str] = mapped_column(String(64),unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip: Mapped[str] = mapped_column(String(100))
    user_agent: Mapped[str] = mapped_column(String(500))

class RequestBlock(Entity, Base):
    __tablename__ = 'request_blocks'
    request_id: Mapped[UUID] = mapped_column(ForeignKey('requests.id',ondelete='CASCADE'),index=True)
    kind: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)
    __table_args__ = (UniqueConstraint('request_id','position'),CheckConstraint('position >= 0',name='position'),CheckConstraint(BLOCK_KIND_CHECK,name='kind'))

class RequestContact(Entity, Base):
    __tablename__ = 'request_contacts'
    request_id: Mapped[UUID] = mapped_column(ForeignKey('requests.id',ondelete='CASCADE'),index=True)
    kind: Mapped[str] = mapped_column(String(20))
    value: Mapped[str] = mapped_column(String(320))
    value_normalized: Mapped[str] = mapped_column(String(320))
    __table_args__ = (UniqueConstraint('request_id','kind'),Index('ix_request_contacts_kind_value','kind','value_normalized'),CheckConstraint("kind IN ('email','telegram','vk')",name='kind'))

class RequestClaimCode(Entity, Base):
    __tablename__ = 'request_claim_codes'
    request_id: Mapped[UUID] = mapped_column(ForeignKey('requests.id',ondelete='CASCADE'))
    code_hash: Mapped[str] = mapped_column(String(64))
    failed_attempts: Mapped[int] = mapped_column(Integer,default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (Index('uq_request_active_claim_code','request_id',unique=True,postgresql_where=text('used_at IS NULL AND revoked_at IS NULL')),CheckConstraint('failed_attempts >= 0',name='attempts'))

class RequestAccessToken(Entity, Base):
    __tablename__ = 'request_access_tokens'
    request_id: Mapped[UUID] = mapped_column(ForeignKey('requests.id',ondelete='CASCADE'),index=True)
    token_hash: Mapped[str] = mapped_column(String(64),unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

class RequestStatusHistory(Entity, Base):
    __tablename__ = 'request_status_history'
    request_id: Mapped[UUID] = mapped_column(ForeignKey('requests.id',ondelete='CASCADE'),index=True)
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    changed_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id',ondelete='SET NULL'))
    comment: Mapped[str] = mapped_column(Text,default='')
    __table_args__ = (CheckConstraint("to_status IN ('new','estimating','agreed','in_progress','done','cancelled')",name='to_status'),CheckConstraint("from_status IS NULL OR from_status IN ('new','estimating','agreed','in_progress','done','cancelled')",name='from_status'))

class RequestClaimEvent(Entity, Base):
    __tablename__ = 'request_claim_events'
    performed_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id',ondelete='SET NULL'))
    request_id: Mapped[UUID] = mapped_column(ForeignKey('requests.id',ondelete='CASCADE'),index=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id',ondelete='CASCADE'))
    method: Mapped[str] = mapped_column(String(30))
    ip: Mapped[str] = mapped_column(String(100))
    __table_args__ = (CheckConstraint("method IN ('claim_code','registration_code','browser_token','email_match','auto_submit','manager')",name='method'),)

class RateLimitHit(Entity, Base):
    __tablename__ = 'rate_limit_hits'
    key: Mapped[str] = mapped_column(String(250))
    __table_args__ = (Index('ix_rate_limit_hits_key_created','key','created_at'),)

class EmailLog(Entity, Base):
    __tablename__ = 'email_log'
    to_email: Mapped[str] = mapped_column(String(320))
    template: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20))
    error: Mapped[str | None] = mapped_column(String(200))
    __table_args__ = (CheckConstraint("status IN ('sent','failed')",name='status'),)

class ChatThread(Entity, Base):
    __tablename__ = 'chat_threads'
    kind: Mapped[str] = mapped_column(String(10))
    request_id: Mapped[UUID | None] = mapped_column(ForeignKey('requests.id', ondelete='CASCADE'))
    user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    client_last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    manager_last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    client_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    manager_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint("(kind='request' AND request_id IS NOT NULL) OR (kind='direct' AND request_id IS NULL)",name='kind'),
        Index('uq_chat_request','request_id',unique=True,postgresql_where=text("kind='request'")),
        Index('uq_chat_direct','user_id',unique=True,postgresql_where=text("kind='direct'")),
        Index('ix_chat_recent',text('last_message_at DESC NULLS LAST')),
    )

class ChatMessage(Entity, Base):
    __tablename__ = 'chat_messages'
    id: Mapped[int] = mapped_column(BigInteger,Identity(always=True),primary_key=True)
    thread_id: Mapped[UUID] = mapped_column(ForeignKey('chat_threads.id',ondelete='CASCADE'))
    sender_type: Mapped[str] = mapped_column(String(20))
    sender_user_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id',ondelete='SET NULL'))
    body: Mapped[str] = mapped_column(Text)
    client_msg_id: Mapped[UUID | None]
    __table_args__ = (
        Index('ix_chat_message_cursor','thread_id','id'),
        Index('uq_chat_client_msg','thread_id','client_msg_id',unique=True,postgresql_where=text('client_msg_id IS NOT NULL')),
        CheckConstraint("sender_type IN ('user','manager','system')",name='sender_type'),
        CheckConstraint('char_length(body) BETWEEN 1 AND 2000',name='body'),
    )
