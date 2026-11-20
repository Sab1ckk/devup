"""admin_accounts"""
from alembic import op
revision='0004'
down_revision='0003'
branch_labels=None
depends_on=None

def upgrade():
    op.execute('ALTER TABLE users ADD COLUMN username VARCHAR(32)')
    op.execute("ALTER TABLE users ADD CONSTRAINT ck_users_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9._-]{3,32}$')")
    op.execute('CREATE UNIQUE INDEX uq_users_username ON users(username) WHERE username IS NOT NULL')
    op.execute("ALTER TABLE users ADD CONSTRAINT ck_users_manager_username CHECK (role <> 'manager' OR username IS NOT NULL) NOT VALID")
    op.execute('ALTER TABLE auth_challenges DROP CONSTRAINT ck_auth_challenges_purpose')
    op.execute("ALTER TABLE auth_challenges ADD CONSTRAINT ck_auth_challenges_purpose CHECK (purpose IN ('register','login','admin_login'))")
    op.execute("ALTER TABLE sessions ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'client'")
    op.execute("ALTER TABLE sessions ADD CONSTRAINT ck_sessions_kind CHECK (kind IN ('client','admin'))")
    op.execute('CREATE INDEX ix_sessions_kind_user ON sessions(kind,user_id)')

def downgrade():
    op.execute("DELETE FROM sessions WHERE kind='admin'")
    op.execute("DELETE FROM auth_challenges WHERE purpose='admin_login'")
    op.execute('DROP INDEX ix_sessions_kind_user')
    op.execute('ALTER TABLE sessions DROP COLUMN kind')
    op.execute('ALTER TABLE auth_challenges DROP CONSTRAINT ck_auth_challenges_purpose')
    op.execute("ALTER TABLE auth_challenges ADD CONSTRAINT ck_auth_challenges_purpose CHECK (purpose IN ('register','login'))")
    op.execute('ALTER TABLE users DROP CONSTRAINT ck_users_manager_username')
    op.execute('DROP INDEX uq_users_username')
    op.execute('ALTER TABLE users DROP CONSTRAINT ck_users_username_format')
    op.execute('ALTER TABLE users DROP COLUMN username')
