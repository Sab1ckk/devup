from datetime import timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Query
from pydantic import Field
from sqlalchemy import func, select, or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from models import User
from app.admin_auth import require_admin
from app.api import current
from app.config import settings
from app.db import db_session
from app.mail import enqueue
from app.models import ChatMessage as Message, ChatThread as Thread, ProjectRequest
from app.rate_limit import fail, hit
from app.schemas import Schema
from app.security import now

DB = Depends(db_session)
client = APIRouter(prefix='/api/chat')
admin = APIRouter(prefix='/api/admin/chat', dependencies=[Depends(require_admin)])


def require_client(req: Request, db: Session = DB):
    user, _ = current(db, req, True)
    db.commit()
    return user


CLIENT = Depends(require_client)
ADMIN = Depends(require_admin)


class Send(Schema):
    body: str = Field(min_length=1, max_length=2000)
    client_msg_id: UUID


class ReadMark(Schema):
    through: int | None = Field(None, ge=1)


class Ensure(Schema):
    user_id: UUID | None = None
    request_number: int | None = None


def missing():
    fail(404, 'not_found', 'Диалог не найден.')


def request_target(db, number, owner=None):
    project = db.scalar(select(ProjectRequest).where(
        ProjectRequest.number == number, ProjectRequest.user_id.is_not(None)))
    if not project or (owner and owner != project.user_id):
        missing()
    return project


def thread_for(db, owner, project=None, create=False):
    kind = 'request' if project else 'direct'
    condition = Thread.request_id == project.id if project else Thread.user_id == owner
    if create:
        db.execute(insert(Thread).values(kind=kind, user_id=owner, request_id=project.id if project else None)
                   .on_conflict_do_nothing())
    return db.scalar(select(Thread).where(Thread.kind == kind, condition))


def message_data(message, manager=False):
    sender = message.sender_type
    return {'id': str(message.id), 'from': ('client' if manager else 'me') if sender == 'user' else sender,
            'body': message.body, 'created_at': message.created_at.astimezone(timezone.utc), 'client_msg_id': message.client_msg_id}


def unread_condition(manager):
    mark = Thread.manager_last_read_at if manager else Thread.client_last_read_at
    return (Message.thread_id == Thread.id, Message.sender_type == ('user' if manager else 'manager'),
            or_(mark.is_(None), Message.created_at > mark))


def describe(db, thread, project=None, manager=False):
    if manager and thread.request_id:
        project = db.get(ProjectRequest, thread.request_id)
    result = {'id': thread.id if thread else None, 'kind': 'request' if project else 'direct',
              'request_number': project.number if project else None,
              'status': project.status if project else None, 'unread': 0, 'last_message': None}
    if thread:
        result['unread'] = db.scalar(select(func.count()).select_from(Message).where(
            Message.thread_id == thread.id, Message.sender_type == ('user' if manager else 'manager'),
            *([Message.created_at > mark] if (mark := (thread.manager_last_read_at if manager else thread.client_last_read_at)) else [])))
        latest = db.scalar(select(Message).where(Message.thread_id == thread.id).order_by(Message.id.desc()).limit(1))
        if latest:
            result['last_message'] = message_data(latest, manager)
    if manager:
        user = db.get(User, thread.user_id)
        result['owner'] = {'id': user.id, 'email': user.email}
    return result


@client.get('/threads')
def client_threads(user: User = CLIENT, db: Session = DB):
    threads = db.scalars(select(Thread).where(Thread.user_id == user.id)).all()
    by_request = {t.request_id: t for t in threads}
    projects = db.scalars(select(ProjectRequest).where(ProjectRequest.user_id == user.id)
                          .order_by(ProjectRequest.number.desc())).all()
    projects.sort(key=lambda p: by_request[p.id].last_message_at.timestamp() if p.id in by_request and by_request[p.id].last_message_at else 0, reverse=True)
    return [describe(db, by_request.get(None))] + [describe(db, by_request.get(p.id), p) for p in projects]


@client.get('/unread')
def client_unread(user: User = CLIENT, db: Session = DB):
    return {'unread': db.scalar(select(func.count()).select_from(Message).join(Thread)
                               .where(Thread.user_id == user.id, *unread_condition(False)))}


def messages(db, thread, after, before, limit, manager=False):
    if after is not None and before is not None:
        fail(422, 'cursor', 'Используй один курсор.')
    if not thread:
        return {'messages': [], 'has_more_before': False}
    limit = limit or settings().chat_page_size
    stmt = select(Message).where(Message.thread_id == thread.id)
    if after is not None:
        stmt = stmt.where(Message.id > after).order_by(Message.id)
    else:
        if before is not None:
            stmt = stmt.where(Message.id < before)
        stmt = stmt.order_by(Message.id.desc())
    rows = db.scalars(stmt.limit(limit + 1)).all()
    result = rows[:limit]
    return {'messages': [message_data(m, manager) for m in (result if after is not None else reversed(result))],
            'has_more_before': after is None and len(rows) > limit}


def lock_thread(db, thread):
    return db.scalar(select(Thread).where(Thread.id == thread.id).with_for_update()
                     .execution_options(populate_existing=True))


def send(db, thread, user, data, tasks, manager=False):
    thread = lock_thread(db, thread)
    previous = db.scalar(select(Message).where(Message.thread_id == thread.id,
                                               Message.client_msg_id == data.client_msg_id))
    if previous:
        if previous.sender_user_id != user.id:
            fail(409, 'message_id', 'Повтори отправку с новым идентификатором.')
        return message_data(previous, manager)
    cfg = settings()
    if len(data.body) > cfg.chat_max_message_length:
        fail(422, 'message_length', 'Сообщение слишком длинное.', 'body')
    key = f'chat_send:user:{user.id}'
    hit(db, key + ':minute', cfg.chat_manager_rate_per_minute if manager else cfg.chat_rate_per_minute, 60)
    if not manager:
        hit(db, key + ':day', cfg.chat_rate_per_day, 86400)
    at = now()
    message = Message(thread_id=thread.id, sender_type='manager' if manager else 'user',
                      sender_user_id=user.id, body=data.body, client_msg_id=data.client_msg_id, created_at=at)
    db.add(message)
    thread.last_message_at = at
    notify(db, thread, tasks, at, manager)
    db.commit()
    return message_data(message, manager)


def notify(db, thread, tasks, at, manager):
    cfg = settings()
    target = 'client' if manager else 'manager'
    field = target + '_notified_at'
    sent, read = getattr(thread, field), getattr(thread, target + '_last_read_at')
    if ((sent and at - sent < timedelta(minutes=cfg.chat_email_throttle_minutes)) or
            (read and at - read < timedelta(seconds=cfg.chat_active_window_seconds))):
        return
    project = db.get(ProjectRequest, thread.request_id) if thread.request_id else None
    owner = db.get(User, thread.user_id)
    recipients = [owner] if manager else db.scalars(select(User).where(
        User.role == 'manager', User.is_active.is_(True))).all()
    for recipient in recipients:
        enqueue(db, tasks, recipient.email, 'chat_' + target, {
            'thread_id': str(thread.id), 'number': project.number if project else None, 'owner': owner.email})
    if recipients:
        setattr(thread, field, at)


def read(db, thread, manager=False, through=None):
    if thread:
        thread = lock_thread(db, thread)
        at = now()
        if through is not None:
            unseen = db.scalar(select(Message.id).where(Message.thread_id == thread.id,
                 Message.id > through, Message.sender_type == ('user' if manager else 'manager')).limit(1))
            if unseen:
                at = db.scalar(select(Message.created_at).where(Message.thread_id == thread.id, Message.id == through))
        field = 'manager_last_read_at' if manager else 'client_last_read_at'
        old = getattr(thread, field)
        if at and (old is None or at > old):
            setattr(thread, field, at)
        db.commit()
    return {'ok': True}


def resolve_client(db, user, number, create=False):
    return thread_for(db, user.id, request_target(db, number, user.id) if number is not None else None, create)


@client.get('/direct/messages')
@client.get('/requests/{number}/messages')
def client_messages(user: User = CLIENT, db: Session = DB, number: int = None,
                    after: int | None = Query(None, ge=0), before: int | None = Query(None, ge=1),
                    limit: int | None = Query(None, ge=1, le=100)):
    return messages(db, resolve_client(db, user, number), after, before, limit)


@client.post('/direct/messages')
@client.post('/requests/{number}/messages')
def client_send(data: Send, tasks: BackgroundTasks, user: User = CLIENT, db: Session = DB, number: int = None):
    return send(db, resolve_client(db, user, number, True), user, data, tasks)


@client.post('/direct/read')
@client.post('/requests/{number}/read')
def client_read(data: ReadMark, user: User = CLIENT, db: Session = DB, number: int = None):
    return read(db, resolve_client(db, user, number), through=data.through)


def has_unread():
    return select(Message.id).where(*unread_condition(True)).correlate(Thread).exists()


@admin.get('/unread')
def admin_unread(db: Session = DB):
    return {'unread': db.scalar(select(func.count()).select_from(Thread).where(has_unread()))}


@admin.get('/threads')
def admin_threads(filter: Literal['all','unread','request','direct'] = 'all',
                  q: str = Query('', max_length=320), page: int = Query(1, ge=1), db: Session = DB):
    query = select(Thread)
    if filter == 'unread':
        query = query.where(has_unread())
    elif filter != 'all':
        query = query.where(Thread.kind == filter)
    if q.strip():
        pattern = '%' + q.strip() + '%'
        query = query.join(User, Thread.user_id == User.id).outerjoin(ProjectRequest, Thread.request_id == ProjectRequest.id)
        query = query.where(or_(User.email.ilike(pattern), func.concat('DEVUP-', ProjectRequest.number).ilike(pattern)))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(Thread.last_message_at.desc().nulls_last(), Thread.id)
                      .offset((page - 1) * 20).limit(20)).all()
    return {'items': [describe(db, t, manager=True) for t in rows], 'pages': max(1, (total + 19)//20)}


@admin.post('/threads/ensure')
def ensure(data: Ensure, db: Session = DB):
    if (data.user_id is None) == (data.request_number is None):
        fail(422, 'target', 'Выбери заявку или клиента.')
    project = request_target(db, data.request_number) if data.request_number is not None else None
    user = db.get(User, project.user_id if project else data.user_id)
    if not user or user.role not in ('client', 'customer') or not user.email_verified_at:
        fail(404, 'not_found', 'Подтверждённый клиент не найден.')
    thread = thread_for(db, user.id, project, True)
    db.commit()
    return describe(db, thread, project, True)


def get_thread(db, identifier):
    thread = db.get(Thread, identifier)
    if not thread:
        missing()
    return thread


@admin.get('/threads/{identifier}')
def admin_thread(identifier: UUID, db: Session = DB):
    return describe(db, get_thread(db, identifier), manager=True)


@admin.get('/threads/{identifier}/messages')
def admin_messages(identifier: UUID, db: Session = DB, after: int | None = Query(None, ge=0),
                   before: int | None = Query(None, ge=1), limit: int | None = Query(None, ge=1, le=100)):
    return messages(db, get_thread(db, identifier), after, before, limit, True)


@admin.post('/threads/{identifier}/messages')
def admin_send(identifier: UUID, data: Send, tasks: BackgroundTasks, user: User = ADMIN, db: Session = DB):
    return send(db, get_thread(db, identifier), user, data, tasks, True)


@admin.post('/threads/{identifier}/read')
def admin_read(identifier: UUID, data: ReadMark, db: Session = DB):
    return read(db, get_thread(db, identifier), True, data.through)

