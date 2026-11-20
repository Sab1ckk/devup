"""Replace the empty chat foundation with cursor-based conversations."""
from alembic import op
revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def replace_schema(statements):
    op.execute("LOCK TABLE chat_threads, chat_messages IN ACCESS EXCLUSIVE MODE")
    op.execute("""DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM chat_threads) OR EXISTS (SELECT 1 FROM chat_messages) THEN
            RAISE EXCEPTION 'Chat tables contain data. Export and migrate it before changing the chat schema.';
        END IF;
    END $$""")
    op.drop_table('chat_messages')
    op.drop_table('chat_threads')
    for statement in statements:
        op.execute(statement)


def upgrade():
    replace_schema(NEW)


def downgrade():
    replace_schema(OLD)


NEW = ["\nCREATE TABLE chat_threads (\n\tkind VARCHAR(10) NOT NULL, \n\trequest_id UUID, \n\tuser_id UUID NOT NULL, \n\tclosed_at TIMESTAMP WITH TIME ZONE, \n\tlast_message_at TIMESTAMP WITH TIME ZONE, \n\tclient_last_read_at TIMESTAMP WITH TIME ZONE, \n\tmanager_last_read_at TIMESTAMP WITH TIME ZONE, \n\tclient_notified_at TIMESTAMP WITH TIME ZONE, \n\tmanager_notified_at TIMESTAMP WITH TIME ZONE, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tCONSTRAINT pk_chat_threads PRIMARY KEY (id), \n\tCONSTRAINT ck_chat_threads_kind CHECK ((kind='request' AND request_id IS NOT NULL) OR (kind='direct' AND request_id IS NULL)), \n\tCONSTRAINT fk_chat_threads_request_id_requests FOREIGN KEY(request_id) REFERENCES requests (id) ON DELETE CASCADE, \n\tCONSTRAINT fk_chat_threads_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE\n)\n\n", 'CREATE INDEX ix_chat_recent ON chat_threads (last_message_at DESC NULLS LAST)', 'CREATE INDEX ix_chat_threads_user_id ON chat_threads (user_id)', "CREATE UNIQUE INDEX uq_chat_direct ON chat_threads (user_id) WHERE kind='direct'", "CREATE UNIQUE INDEX uq_chat_request ON chat_threads (request_id) WHERE kind='request'", "\nCREATE TABLE chat_messages (\n\tid BIGINT GENERATED ALWAYS AS IDENTITY, \n\tthread_id UUID NOT NULL, \n\tsender_type VARCHAR(20) NOT NULL, \n\tsender_user_id UUID, \n\tbody TEXT NOT NULL, \n\tclient_msg_id UUID, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tCONSTRAINT pk_chat_messages PRIMARY KEY (id), \n\tCONSTRAINT ck_chat_messages_sender_type CHECK (sender_type IN ('user','manager','system')), \n\tCONSTRAINT ck_chat_messages_body CHECK (char_length(body) BETWEEN 1 AND 2000), \n\tCONSTRAINT fk_chat_messages_thread_id_chat_threads FOREIGN KEY(thread_id) REFERENCES chat_threads (id) ON DELETE CASCADE, \n\tCONSTRAINT fk_chat_messages_sender_user_id_users FOREIGN KEY(sender_user_id) REFERENCES users (id) ON DELETE SET NULL\n)\n\n", 'CREATE INDEX ix_chat_message_cursor ON chat_messages (thread_id, id)', 'CREATE UNIQUE INDEX uq_chat_client_msg ON chat_messages (thread_id, client_msg_id) WHERE client_msg_id IS NOT NULL']
OLD = ['\nCREATE TABLE chat_threads (\n\trequest_id UUID NOT NULL, \n\tclosed_at TIMESTAMP WITH TIME ZONE, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tCONSTRAINT pk_chat_threads PRIMARY KEY (id), \n\tCONSTRAINT uq_chat_threads_request_id UNIQUE (request_id), \n\tCONSTRAINT fk_chat_threads_request_id_requests FOREIGN KEY(request_id) REFERENCES requests (id) ON DELETE CASCADE\n)\n\n', "\nCREATE TABLE chat_messages (\n\tthread_id UUID NOT NULL, \n\tsender_type VARCHAR(20) NOT NULL, \n\tsender_user_id UUID, \n\tbody TEXT NOT NULL, \n\tread_at TIMESTAMP WITH TIME ZONE, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tCONSTRAINT pk_chat_messages PRIMARY KEY (id), \n\tCONSTRAINT ck_chat_messages_sender_type CHECK (sender_type IN ('guest','user','manager','system')), \n\tCONSTRAINT fk_chat_messages_thread_id_chat_threads FOREIGN KEY(thread_id) REFERENCES chat_threads (id) ON DELETE CASCADE, \n\tCONSTRAINT fk_chat_messages_sender_user_id_users FOREIGN KEY(sender_user_id) REFERENCES users (id) ON DELETE SET NULL\n)\n\n", 'CREATE INDEX ix_chat_messages_thread_created ON chat_messages (thread_id, created_at)']
