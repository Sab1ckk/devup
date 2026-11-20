from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select, func

from app.db import SessionLocal
from app.main import app
from app.models import ChatThread, ChatMessage
from app.mail import render
from app.security import now
from test_flows import auth, guest, post
from test_admin import admin_login


def send(client, endpoint='/chat/direct/messages', body='Текст сообщения', key=None):
    return post(client, endpoint, {'body': body, 'client_msg_id': str(key or uuid4())})


def test_chat_access_and_virtual_threads(client, isolated_db):
    assert client.get('/api/chat/threads').status_code == 401
    owned = guest(client)
    auth(client, isolated_db)
    assert post(client,'/claims/apply',{'numbers':[owned['number']]}).status_code == 200
    rows = client.get('/api/chat/threads').json()
    assert [t['kind'] for t in rows] == ['direct','request']
    assert all(t['id'] is None for t in rows)
    other = guest(TestClient(app))
    endpoint = f"/chat/requests/{other['number']}/messages"
    expected = client.get('/api/chat/requests/999999/messages').json()
    assert client.get('/api'+endpoint).json() == expected
    assert send(client, endpoint).status_code == 404
    assert client.get('/api/admin/chat/threads').status_code == 401


def test_chat_concurrent_first_message_and_debounce(client, isolated_db):
    auth(client, isolated_db)
    manager = TestClient(app)
    admin_login(manager, isolated_db)
    key = uuid4()
    with ThreadPoolExecutor(max_workers=2) as workers:
        first, second = list(workers.map(lambda _:send(client,key=key),range(2)))
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    with SessionLocal() as db:
        thread = db.scalar(select(ChatThread))
        assert thread.last_message_at
        assert db.scalar(select(func.count()).select_from(ChatThread)) == 1
        assert db.scalar(select(func.count()).select_from(ChatMessage)) == 1
        identifier = thread.id
    assert manager.get('/api/chat/threads').status_code == 401
    assert manager.get('/api/admin/chat/unread').json() == {'unread':1}
    assert len(manager.get('/api/admin/chat/threads?filter=unread&q=person').json()['items']) == 1
    route = f'/admin/chat/threads/{identifier}'
    assert post(manager,route+'/read',{}).status_code == 200
    assert manager.get('/api/admin/chat/unread').json() == {'unread':0}
    for _ in range(2):
        result = send(manager,route+'/messages',body='Ответ менеджера')
        assert result.status_code == 200
        assert result.json()['from'] == 'manager' and 'sender_user_id' not in result.json()
    assert client.get('/api/chat/unread').json() == {'unread':2}
    rows = client.get('/api/chat/direct/messages?limit=2').json()
    assert rows['has_more_before']
    assert len(client.get('/api/chat/direct/messages?before='+rows['messages'][0]['id']).json()['messages']) == 1
    assert len(client.get('/api/chat/direct/messages?after='+rows['messages'][0]['id']).json()['messages']) == 1
    assert post(client,'/chat/direct/read',{'through':rows['messages'][0]['id']}).status_code == 200
    assert client.get('/api/chat/unread').json() == {'unread':1}
    assert post(client,'/chat/direct/read',{}).status_code == 200
    assert client.get('/api/chat/unread').json() == {'unread':0}
    with SessionLocal.begin() as db:
        db.get(ChatThread,identifier).client_notified_at = now()-timedelta(minutes=31)
    assert send(manager,route+'/messages').status_code == 200
    notices = [m for m in isolated_db if m[1].startswith('chat_')]
    assert sorted(m[1] for m in notices) == ['chat_client','chat_manager']
    for _,template,context in notices:
        _,body,_ = render(template,context)
        assert '/chat' in body and 'Текст сообщения' not in body and 'Ответ менеджера' not in body


def test_limits_validation_and_manager_ensure(client, isolated_db):
    user = auth(client, isolated_db)['user']
    manager = TestClient(app)
    admin_login(manager, isolated_db)
    first = post(manager,'/admin/chat/threads/ensure',{'user_id':user['id']})
    assert first.status_code == 200
    assert post(manager,'/admin/chat/threads/ensure',{'user_id':user['id']}).json()['id'] == first.json()['id']
    for invalid in ('', '   ', 'а'*2001):
        assert send(client,body=invalid).status_code == 422
    for _ in range(10):
        assert send(client).status_code == 200
    limited = send(client)
    assert limited.status_code == 429 and 'retry-after' in limited.headers


def test_request_chat_requires_owner_and_notifies_active_managers(client, isolated_db):
    from app.admin_cli import create_manager

    project = guest(client)
    path = f"/chat/requests/{project['number']}/messages"
    manager = TestClient(app)
    admin_login(manager, isolated_db)
    ensure_path = '/admin/chat/threads/ensure'
    target = {'request_number': project['number']}
    assert post(manager, ensure_path, target).status_code == 404
    auth(client, isolated_db)
    assert send(client, path).status_code == 404
    assert post(client, '/claims/apply', {'numbers': [project['number']]}).status_code == 200
    create_manager('other_manager', 'other-manager@example.com', 'Other-password-123')
    thread = post(manager, ensure_path, target).json()
    assert thread['request_number'] == project['number']
    assert thread['owner']['email'] == 'person@example.com'
    assert send(client, path).status_code == 200
    notices = [message for message in isolated_db if message[1] == 'chat_manager']
    assert {notice[0] for notice in notices} == {'qa-admin@example.com', 'other-manager@example.com'}
    assert all(notice[2]['thread_id'] == thread['id'] for notice in notices)
    assert manager.get('/api/admin/chat/threads?filter=request&q=DEVUP-' + str(project['number'])).json()['items'][0]['id'] == thread['id']
