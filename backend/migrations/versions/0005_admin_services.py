"""admin_services"""
from alembic import op
revision='0005'
down_revision='0004'
branch_labels=None
depends_on=None

def upgrade():
    op.execute("ALTER TABLE services ADD COLUMN features JSONB NOT NULL DEFAULT '[]'")
    op.execute('ALTER TABLE services ADD COLUMN price_from INTEGER')
    op.execute('ALTER TABLE services ADD COLUMN position INTEGER NOT NULL DEFAULT 0')
    op.execute('ALTER TABLE services ADD COLUMN updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL')
    op.execute('UPDATE services SET price_from=base_price::integer, position=sort_order')
    op.execute('ALTER TABLE services ADD CONSTRAINT ck_services_price_from CHECK (price_from >= 0)')
    op.execute("ALTER TABLE services ADD CONSTRAINT ck_services_code CHECK (code IN ('site','app','small','study')) NOT VALID")
    op.execute('INSERT INTO services (id,code,title,description,features,price_from,base_price,position,sort_order) VALUES (\'518b8d54-10c3-4b7e-8338-1dd548b12f74\',\'site\',\'Сайты\',\'Лендинги, многостраничные сайты, магазины с оплатой.\',\'["Адаптив под телефон", "Формы заявок"]\'::jsonb,18000,18000,0,0) ON CONFLICT (code) DO NOTHING')
    op.execute('INSERT INTO services (id,code,title,description,features,price_from,base_price,position,sort_order) VALUES (\'9d6894b7-2219-4af0-b047-7ac4ef9a1e4c\',\'app\',\'Android-приложения\',\'Нативные приложения под задачу.\',\'["Уведомления, офлайн", "Подготовка к публикации"]\'::jsonb,35000,35000,1,1) ON CONFLICT (code) DO NOTHING')
    op.execute("INSERT INTO services (id,code,title,description,features,price_from,base_price,position,sort_order) VALUES ('abc18f71-3aae-4ae3-9ea8-284455fb2249','small','Небольшие проекты','Боты, админки, калькуляторы, доработки.','[]'::jsonb,9000,9000,2,2) ON CONFLICT (code) DO NOTHING")
    op.execute("INSERT INTO services (id,code,title,description,features,price_from,base_price,position,sort_order) VALUES ('cfbc405b-5b96-448e-adda-dc9f056eab45','study','Мини-задания для учёбы','Лабораторные, курсовые, небольшие задачи с разбором решения.','[]'::jsonb,2500,2500,3,3) ON CONFLICT (code) DO NOTHING")

def downgrade():
    op.execute('ALTER TABLE services DROP CONSTRAINT ck_services_code')
    op.execute('ALTER TABLE services DROP CONSTRAINT ck_services_price_from')
    op.execute('ALTER TABLE services DROP COLUMN updated_by_user_id')
    op.execute('ALTER TABLE services DROP COLUMN position')
    op.execute('ALTER TABLE services DROP COLUMN price_from')
    op.execute('ALTER TABLE services DROP COLUMN features')
