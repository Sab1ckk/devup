from alembic import context
from sqlalchemy import create_engine
from app.config import settings
from models import Base
import app.models


if context.is_offline_mode():
    context.configure(url=settings().sync_url,target_metadata=Base.metadata,literal_binds=True)
    with context.begin_transaction(): context.run_migrations()
else:
    engine=create_engine(settings().sync_url,hide_parameters=True)
    with engine.connect() as connection:
        context.configure(connection=connection,target_metadata=Base.metadata,compare_type=True)
        with context.begin_transaction(): context.run_migrations()
    engine.dispose()
