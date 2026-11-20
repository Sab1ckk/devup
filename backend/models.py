from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (Boolean, CheckConstraint, DateTime, ForeignKey, Index, Identity, Integer,
                        MetaData, Numeric, String, Text, UniqueConstraint, func)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention={
        'ix': 'ix_%(table_name)s_%(column_0_name)s',
        'uq': 'uq_%(table_name)s_%(column_0_name)s',
        'ck': 'ck_%(table_name)s_%(constraint_name)s',
        'fk': 'fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s',
        'pk': 'pk_%(table_name)s',
    })


class Entity:
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(Entity, Base):
    __tablename__ = 'users'
    email: Mapped[str] = mapped_column(String(320), unique=True)
    username: Mapped[str | None] = mapped_column(String(32))
    password_hash: Mapped[str] = mapped_column(Text)
    display_name: Mapped[str] = mapped_column(String(120), default="")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    role: Mapped[str] = mapped_column(String(20), server_default='client')
    is_active: Mapped[bool] = mapped_column(Boolean, server_default='true')
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint("role IN ('client','customer','manager','admin')", name='role'),
        CheckConstraint('email = lower(trim(email))', name='normalized_email'),
        CheckConstraint("username IS NULL OR username ~ '^[a-z0-9._-]{3,32}$'",name='username_format'),
        CheckConstraint("role <> 'manager' OR username IS NOT NULL",name='manager_username'),
        Index('uq_users_username','username',unique=True,postgresql_where=__import__('sqlalchemy').text('username IS NOT NULL')),
    )


class AuthToken(Entity, Base):
    __tablename__ = 'auth_tokens'
    user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    purpose: Mapped[str] = mapped_column(String(30))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (CheckConstraint("purpose IN ('refresh','verify_email','reset_password','claim_order')", name='purpose'),)


class Service(Entity, Base):
    __tablename__ = 'services'
    code: Mapped[str] = mapped_column(String(40), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, server_default='')
    features: Mapped[list] = mapped_column(JSONB, server_default='[]')
    price_from: Mapped[int | None] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer, server_default='0')
    updated_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id',ondelete='SET NULL'))
    base_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), server_default='RUB')
    is_active: Mapped[bool] = mapped_column(Boolean, server_default='true')
    sort_order: Mapped[int] = mapped_column(Integer, server_default='0')
    __table_args__ = (CheckConstraint('base_price >= 0', name='positive_price'),CheckConstraint('price_from >= 0',name='price_from'),CheckConstraint("code IN ('site','app','small','study')",name='code'))


class BlockKind(Entity, Base):
    __tablename__ = 'block_kinds'
    code: Mapped[str] = mapped_column(String(50), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(30))
    hint: Mapped[str] = mapped_column(Text, server_default='')
    is_unique: Mapped[bool] = mapped_column(Boolean, server_default='false')
    is_active: Mapped[bool] = mapped_column(Boolean, server_default='true')


class ServiceBlockPrice(Entity, Base):
    __tablename__ = 'service_block_prices'
    service_id: Mapped[UUID] = mapped_column(ForeignKey('services.id', ondelete='CASCADE'))
    block_kind_id: Mapped[UUID] = mapped_column(ForeignKey('block_kinds.id', ondelete='CASCADE'))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    __table_args__ = (UniqueConstraint('service_id', 'block_kind_id'), CheckConstraint('price >= 0', name='positive_price'))


class Order(Entity, Base):
    __tablename__ = 'orders'
    number: Mapped[int] = mapped_column(Integer, Identity(), unique=True, nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), index=True)
    manager_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'))
    service_id: Mapped[UUID] = mapped_column(ForeignKey('services.id', ondelete='RESTRICT'), index=True)
    status: Mapped[str] = mapped_column(String(30), server_default='new', index=True)
    company_brief: Mapped[str] = mapped_column(Text, server_default='')
    wishes: Mapped[str] = mapped_column(Text, server_default='')
    references: Mapped[str] = mapped_column(Text, server_default='')
    deadline_notes: Mapped[str] = mapped_column(Text, server_default='')
    budget_notes: Mapped[str] = mapped_column(Text, server_default='')
    contact: Mapped[str] = mapped_column(Text)
    estimated_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    agreed_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), server_default='RUB')
    pricing_snapshot: Mapped[dict] = mapped_column(JSONB, server_default='{}')
    __table_args__ = (CheckConstraint("status IN ('new','estimating','agreement','in_progress','completed','cancelled')", name='status'), CheckConstraint('estimated_price >= 0 AND agreed_price >= 0', name='positive_prices'))


class OrderBlock(Entity, Base):
    __tablename__ = 'order_blocks'
    order_id: Mapped[UUID] = mapped_column(ForeignKey('orders.id', ondelete='CASCADE'), index=True)
    block_kind_id: Mapped[UUID] = mapped_column(ForeignKey('block_kinds.id', ondelete='RESTRICT'))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, server_default='')
    position: Mapped[int] = mapped_column(Integer)
    __table_args__ = (UniqueConstraint('order_id', 'position', deferrable=True, initially='DEFERRED'), CheckConstraint('position >= 0', name='position'))


class Attachment(Entity, Base):
    __tablename__ = 'attachments'
    order_id: Mapped[UUID] = mapped_column(ForeignKey('orders.id', ondelete='CASCADE'), index=True)
    uploaded_by: Mapped[UUID | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'))
    storage_key: Mapped[str] = mapped_column(Text, unique=True)
    original_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(150))
    size_bytes: Mapped[int] = mapped_column(Integer)
    __table_args__ = (CheckConstraint('size_bytes > 0 AND size_bytes <= 10485760', name='file_size'),)


class Message(Entity, Base):
    __tablename__ = 'messages'
    order_id: Mapped[UUID] = mapped_column(ForeignKey('orders.id', ondelete='CASCADE'))
    sender_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'))
    body: Mapped[str] = mapped_column(Text)
    __table_args__ = (Index('ix_messages_order_created', 'order_id', 'created_at'), CheckConstraint('length(trim(body)) > 0', name='nonempty_body'))


class PortfolioProject(Entity, Base):
    __tablename__ = 'portfolio_projects'
    service_id: Mapped[UUID | None] = mapped_column(ForeignKey('services.id',ondelete='RESTRICT'))
    slug: Mapped[str] = mapped_column(String(200),unique=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    is_published: Mapped[bool] = mapped_column(Boolean,server_default='false',index=True)
    sort_order: Mapped[int] = mapped_column(Integer,server_default='0')
    kind: Mapped[str] = mapped_column(String(20),server_default='site')
    status: Mapped[str] = mapped_column(String(20),server_default='draft')
    position: Mapped[int] = mapped_column(Integer,server_default='0')
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id',ondelete='SET NULL'))
    __table_args__ = (CheckConstraint("kind IN ('site','app','small','study')",name='kind'),CheckConstraint("status IN ('draft','published')",name='status'),Index('ix_portfolio_status_position','status','position'))

class MediaFile(Entity, Base):
    __tablename__ = 'media_files'
    key_full: Mapped[str] = mapped_column(Text,unique=True)
    key_thumb: Mapped[str] = mapped_column(Text,unique=True)
    mime: Mapped[str] = mapped_column(String(40),server_default='image/webp')
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    created_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id',ondelete='SET NULL'))
    __table_args__ = (CheckConstraint("mime='image/webp'",name='mime'),CheckConstraint('width>0 AND height>0 AND size_bytes>0',name='dimensions'))

class PortfolioImage(Entity, Base):
    __tablename__ = 'portfolio_images'
    project_id: Mapped[UUID] = mapped_column(ForeignKey('portfolio_projects.id',ondelete='CASCADE'),index=True)
    storage_key: Mapped[str] = mapped_column(Text)
    media_id: Mapped[UUID | None] = mapped_column(ForeignKey('media_files.id',ondelete='RESTRICT'),unique=True)
    alt_text: Mapped[str] = mapped_column(String(300))
    position: Mapped[int] = mapped_column(Integer)
    is_cover: Mapped[bool] = mapped_column(Boolean,server_default='false')
    __table_args__ = (UniqueConstraint('project_id','position',deferrable=True,initially='DEFERRED'),CheckConstraint('position >= 0',name='position'),Index('uq_portfolio_cover','project_id',unique=True,postgresql_where=__import__('sqlalchemy').text('is_cover = true')))


class Review(Entity, Base):
    __tablename__ = 'reviews'
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), index=True)
    order_id: Mapped[UUID | None] = mapped_column(ForeignKey('orders.id', ondelete='SET NULL'), unique=True)
    service_id: Mapped[UUID] = mapped_column(ForeignKey('services.id', ondelete='RESTRICT'))
    author_name: Mapped[str] = mapped_column(String(120))
    rating: Mapped[int] = mapped_column(Integer)
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), server_default='pending', index=True)
    __table_args__ = (CheckConstraint('rating BETWEEN 1 AND 5', name='rating'), CheckConstraint("status IN ('pending','published','rejected')", name='status'))


class SiteContent(Entity, Base):
    __tablename__ = 'site_content'
    key: Mapped[str] = mapped_column(String(100), unique=True)
    value: Mapped[dict] = mapped_column(JSONB)


class AuditLog(Entity, Base):
    __tablename__ = 'audit_logs'
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), index=True)
    action: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[UUID] = mapped_column(index=True)
    changes: Mapped[dict] = mapped_column(JSONB, server_default='{}')
