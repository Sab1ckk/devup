from models import Service,User
from sqlalchemy import insert
from app.security import passwords,now

def seed_services(db):
    rows=[('site','Сайты','Лендинги, многостраничные сайты, магазины с оплатой.',['Адаптив под телефон','Формы заявок'],18000),('app','Android-приложения','Нативные приложения под задачу.',['Уведомления, офлайн','Подготовка к публикации'],35000),('small','Небольшие проекты','Боты, админки, калькуляторы, доработки.',[],9000),('study','Мини-задания для учёбы','Лабораторные, курсовые, небольшие задачи с разбором решения.',[],2500)]
    for position,(code,title,description,features,price) in enumerate(rows):db.execute(insert(Service).values(code=code,title=title,description=description,features=features,base_price=price,price_from=price,position=position))

def seed_manager(db):
    db.execute(insert(User).values(email='qa-admin@example.com',username='qa_admin',password_hash=passwords.hash('Test-admin-123'),display_name='',role='manager',email_verified_at=now()))
