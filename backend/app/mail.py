import html,smtplib,ssl
from email.message import EmailMessage
from typing import Protocol
from app.config import settings
from app.models import EmailLog

class MailSender(Protocol):
    def send(self,to:str,template:str,context:dict): ...

def email_card(label, highlight, footer, *, link=None, link_label='Открыть DEVUP', code=False):
    """Use table cells and inline styles for mail clients, with a fluid card width."""
    ink, background, accent, border = '#f1f1f2', '#080808', '#bfc3c7', '#55595f'
    escape = html.escape
    size = '64px' if code else '32px'
    layout = f"""
<html lang="ru"><body style="margin:0;background:{background};color:{ink};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="{background}">
<tr><td align="center" style="padding:12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"
 style="max-width:460px;border:1px solid {border};border-collapse:collapse;color:{ink};">
<tr><td colspan="2" style="padding:16px;border-bottom:1px solid {border};font:900 32px Arial,sans-serif;">DEVUP</td></tr>
<tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid {border};">
<div style="font:16px 'Courier New',monospace;text-transform:uppercase;">{escape(label)}</div>
<div style="padding-top:6px;color:{accent};font:900 {size}/1 Arial,sans-serif;overflow-wrap:anywhere;">{escape(highlight)}</div>
</td></tr>
"""
    layout += '<tr>'
    for index, text in enumerate(footer):
        split = len(footer) == 2
        width = 'width="50%"' if split else 'colspan="2"'
        divider = f'border-right:1px solid {border};' if split and index == 0 else ''
        font = "'Courier New',monospace" if split and index == 0 else 'Arial,sans-serif'
        layout += (f'<td {width} valign="top" style="padding:14px 16px;{divider}'
                   f'font:16px/1.35 {font};">{escape(text).replace(chr(10), "<br>")}</td>')
    layout += '</tr>'
    if link:
        layout += (f'<tr><td colspan="2" style="padding:14px 16px;border-top:1px solid {border};">'
                   f'<a href="{escape(link, quote=True)}" style="color:{accent};font:bold 16px Arial,sans-serif;">'
                   f'{escape(link_label)}</a></td></tr>')
    return layout + '</table></td></tr></table></body></html>'


def render(template, context):
    if template in ('code', 'admin_code'):
        subject = ('devup: код для входа в админ-панель' if template == 'admin_code'
                   else 'DEVUP: код подтверждения')
        code = str(context['code'])
        minutes = settings().code_minutes
        note = 'Если вход не запрашивался, письмо может быть проигнорировано. Рекомендуется смена пароля.'
        body = f'Код подтверждения: {code}\nСрок действия — {minutes} мин.\n{note}'
        markup = email_card('Код подтверждения', code, [f'СРОК ДЕЙСТВИЯ:\n{minutes} МИН.', note], code=True)
    elif template in ('chat_client', 'chat_manager'):
        to_manager = template == 'chat_manager'
        subject = 'devup: новое сообщение от ' + ('клиента' if to_manager else 'менеджера')
        number = context['number']
        title = f'Заявка DEVUP-{number}' if number is not None else 'Прямой диалог'
        route = (f"/admin/chats/{context['thread_id']}" if to_manager else
                 f'/chat?thread=devup-{number}' if number is not None else '/chat?thread=direct')
        url = settings().base_url.rstrip('/') + route
        note = 'Клиент: ' + context['owner'] if to_manager else 'Ответ менеджера получен в чате.'
        body = title + ('\n' + note if to_manager else '') + '\n' + url
        markup = email_card('Новое сообщение', title, [note], link=url, link_label='Открыть диалог')
    elif template == 'existing':
        subject = 'DEVUP: вход в аккаунт'
        body = 'Аккаунт уже есть. Вход выполняется по почте и паролю.'
        markup = email_card('Вход в аккаунт', 'Аккаунт уже есть', ['Вход выполняется по почте и паролю.'],
                            link=settings().base_url)
    else:
        subject = 'DEVUP: заявка принята'
        number = f"DEVUP-{context['number']}"
        code = context.get('code')
        url = settings().base_url
        body = f'Номер заявки: {number}'
        footer = ['Заявка принята. Номер заявки необходимо сохранить.']
        if code:
            note = 'Код необходимо сохранить для регистрации.'
            body += f'\nКод привязки: {code}\n{note}'
            footer = [f'КОД ПРИВЯЗКИ:\n{code}', note]
        body += '\n' + url
        markup = email_card('Заявка принята', number, footer, link=url)
    return subject, body, markup


class ConsoleSender:
    def send(self,to,template,context):
        # Deliberately no secret output. Use Mailpit to read codes in development.
        print('Development mail prepared (secrets suppressed); configure SMTP to receive it.')

class SMTPSender:
    def send(self,to,template,context):
        cfg=settings(); subject,body,markup=render(template,context)
        message=EmailMessage();message['Subject']=subject;message['From']=cfg.mail_from;message['To']=to
        message.set_content(body);message.add_alternative(markup,subtype='html')
        with smtplib.SMTP(cfg.smtp_host,cfg.smtp_port,timeout=15) as smtp:
            if cfg.smtp_starttls: smtp.starttls(context=ssl.create_default_context())
            if cfg.smtp_user: smtp.login(cfg.smtp_user,cfg.smtp_password)
            smtp.send_message(message)

def deliver(log_id,to,template,context):
    from app.db import SessionLocal
    try:
        if settings().mail_backend!='smtp':
            ConsoleSender().send(to,template,context)
            raise RuntimeError('SMTP not configured')
        SMTPSender().send(to,template,context)
        status,error='sent',None
    except Exception:
        status,error='failed','Не удалось отправить письмо. Код может быть запрошен повторно.'
    with SessionLocal.begin() as db:
        row=db.get(EmailLog,log_id)
        if row: row.status=status;row.error=error

def enqueue(db,tasks,to,template,context):
    log=EmailLog(to_email=to,template=template,status='failed',error='Письмо ожидает отправки')
    db.add(log);db.flush()
    tasks.add_task(deliver,log.id,to,template,context)
    return str(log.id)
