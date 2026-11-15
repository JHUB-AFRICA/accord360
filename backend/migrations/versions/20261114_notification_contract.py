"""Expand notifications into the task-inbox contract.

Revision ID: 20261114_notification_contract
Revises: 20261111_linkages_legal_split
"""
from alembic import op
import sqlalchemy as sa

revision = "20261114_notification_contract"
down_revision = "20261111_linkages_legal_split"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("notifications") as batch:
        batch.add_column(sa.Column("event_type", sa.String(length=100), nullable=False, server_default="workflow.update"))
        batch.add_column(sa.Column("category", sa.String(length=30), nullable=False, server_default="status_update"))
        batch.add_column(sa.Column("severity", sa.String(length=20), nullable=False, server_default="info"))
        batch.add_column(sa.Column("actor_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_notifications_actor_id_users", "users", ["actor_id"], ["id"])
        batch.add_column(sa.Column("action_url", sa.String(length=500), nullable=True))
        batch.add_column(sa.Column("requires_action", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("read_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("resolved_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("dedupe_key", sa.String(length=255), nullable=True))
    op.execute(sa.text("UPDATE notifications SET read_at = created_at WHERE is_read = 1"))
    op.create_index("uq_notifications_dedupe_key", "notifications", ["dedupe_key"], unique=True)
    op.create_index("ix_notifications_user_created_id", "notifications", ["user_id", "created_at", "id"])
    op.create_index("ix_notifications_user_read_created", "notifications", ["user_id", "is_read", "created_at"])
    op.create_index("ix_notifications_agreement_event_user", "notifications", ["agreement_id", "event_type", "user_id"])


def downgrade() -> None:
    op.drop_index("ix_notifications_agreement_event_user", table_name="notifications")
    op.drop_index("ix_notifications_user_read_created", table_name="notifications")
    op.drop_index("ix_notifications_user_created_id", table_name="notifications")
    op.drop_index("uq_notifications_dedupe_key", table_name="notifications")
    with op.batch_alter_table("notifications") as batch:
        batch.drop_constraint("fk_notifications_actor_id_users", type_="foreignkey")
        for column in ("dedupe_key", "resolved_at", "read_at", "requires_action", "action_url", "actor_id", "severity", "category", "event_type"):
            batch.drop_column(column)
