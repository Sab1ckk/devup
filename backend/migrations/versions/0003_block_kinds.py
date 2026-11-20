"""Constrain request block kinds to the shared initial catalog."""
from alembic import op
revision='0003'
down_revision='0002'
branch_labels=None
depends_on=None

def upgrade():
    op.execute("ALTER TABLE request_blocks ADD CONSTRAINT ck_request_blocks_kind CHECK (kind IN ('hero','about','catalog','contacts','account','chat','custom','services','product','cart','portfolio','blog','reviews','faq','form','payment','admin','telegram','map','push','search','languages','crm','analytics','offline','social'))")

def downgrade():
    op.execute('ALTER TABLE request_blocks DROP CONSTRAINT ck_request_blocks_kind')
