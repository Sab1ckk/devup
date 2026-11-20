"""admin_claims"""
from alembic import op
revision='0007'
down_revision='0006'
branch_labels=None
depends_on=None

def upgrade():
    op.execute('ALTER TABLE request_claim_events ADD COLUMN performed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL')

def downgrade():
    op.execute('ALTER TABLE request_claim_events DROP COLUMN performed_by_user_id')
