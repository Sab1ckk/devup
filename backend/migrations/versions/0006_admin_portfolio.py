"""admin_portfolio"""
from alembic import op
revision='0006'
down_revision='0005'
branch_labels=None
depends_on=None

def upgrade():
    op.execute("\nCREATE TABLE media_files (\n\tkey_full TEXT NOT NULL, \n\tkey_thumb TEXT NOT NULL, \n\tmime VARCHAR(40) DEFAULT 'image/webp' NOT NULL, \n\twidth INTEGER NOT NULL, \n\theight INTEGER NOT NULL, \n\tsize_bytes INTEGER NOT NULL, \n\tsha256 VARCHAR(64) NOT NULL, \n\tcreated_by_user_id UUID, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tCONSTRAINT pk_media_files PRIMARY KEY (id), \n\tCONSTRAINT ck_media_files_mime CHECK (mime='image/webp'), \n\tCONSTRAINT ck_media_files_dimensions CHECK (width>0 AND height>0 AND size_bytes>0), \n\tCONSTRAINT uq_media_files_key_full UNIQUE (key_full), \n\tCONSTRAINT uq_media_files_key_thumb UNIQUE (key_thumb), \n\tCONSTRAINT fk_media_files_created_by_user_id_users FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL\n)\n\n")
    op.execute('ALTER TABLE portfolio_projects ALTER COLUMN service_id DROP NOT NULL')
    op.execute("ALTER TABLE portfolio_projects ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'site'")
    op.execute("ALTER TABLE portfolio_projects ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'draft'")
    op.execute('ALTER TABLE portfolio_projects ADD COLUMN position INTEGER NOT NULL DEFAULT 0')
    op.execute('ALTER TABLE portfolio_projects ADD COLUMN published_at TIMESTAMPTZ')
    op.execute('ALTER TABLE portfolio_projects ADD COLUMN updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL')
    op.execute("UPDATE portfolio_projects p SET kind=s.code FROM services s WHERE p.service_id=s.id AND s.code IN ('site','app','small','study')")
    op.execute("UPDATE portfolio_projects SET position=sort_order, status=CASE WHEN is_published THEN 'published' ELSE 'draft' END, published_at=CASE WHEN is_published THEN created_at ELSE NULL END")
    op.execute("ALTER TABLE portfolio_projects ADD CONSTRAINT ck_portfolio_projects_kind CHECK (kind IN ('site','app','small','study'))")
    op.execute("ALTER TABLE portfolio_projects ADD CONSTRAINT ck_portfolio_projects_status CHECK (status IN ('draft','published'))")
    op.execute('CREATE INDEX ix_portfolio_status_position ON portfolio_projects(status,position)')
    op.execute('ALTER TABLE portfolio_images ADD COLUMN media_id UUID UNIQUE REFERENCES media_files(id) ON DELETE RESTRICT')
    op.execute('ALTER TABLE portfolio_images ADD COLUMN is_cover BOOLEAN NOT NULL DEFAULT false')
    op.execute('ALTER TABLE portfolio_images DROP CONSTRAINT uq_portfolio_images_project_id')
    op.execute('ALTER TABLE portfolio_images ADD CONSTRAINT uq_portfolio_images_project_id UNIQUE (project_id,position) DEFERRABLE INITIALLY DEFERRED')
    op.execute('CREATE UNIQUE INDEX uq_portfolio_cover ON portfolio_images(project_id) WHERE is_cover=true')

def downgrade():
    op.execute('DROP INDEX uq_portfolio_cover')
    op.execute('ALTER TABLE portfolio_images DROP CONSTRAINT uq_portfolio_images_project_id')
    op.execute('ALTER TABLE portfolio_images ADD CONSTRAINT uq_portfolio_images_project_id UNIQUE (project_id,position)')
    op.execute('ALTER TABLE portfolio_images DROP COLUMN is_cover')
    op.execute('ALTER TABLE portfolio_images DROP COLUMN media_id')
    op.execute('DROP INDEX ix_portfolio_status_position')
    op.execute('ALTER TABLE portfolio_projects DROP CONSTRAINT ck_portfolio_projects_status')
    op.execute('ALTER TABLE portfolio_projects DROP CONSTRAINT ck_portfolio_projects_kind')
    op.execute('ALTER TABLE portfolio_projects DROP COLUMN updated_by_user_id')
    op.execute('ALTER TABLE portfolio_projects DROP COLUMN published_at')
    op.execute('ALTER TABLE portfolio_projects DROP COLUMN position')
    op.execute('ALTER TABLE portfolio_projects DROP COLUMN status')
    op.execute('ALTER TABLE portfolio_projects DROP COLUMN kind')
    op.execute("UPDATE portfolio_projects SET service_id=(SELECT id FROM services WHERE code='site') WHERE service_id IS NULL")
    op.execute('ALTER TABLE portfolio_projects ALTER COLUMN service_id SET NOT NULL')
    op.execute('DROP TABLE media_files')
