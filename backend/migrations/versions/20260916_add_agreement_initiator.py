"""record the user who initiated an agreement

Revision ID: 20260916_agreement_initiator
Revises: 20260916_scorecards
"""

from alembic import op
import sqlalchemy as sa


revision = "20260916_agreement_initiator"
down_revision = "20260916_scorecards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("agreements") as batch_op:
        batch_op.add_column(sa.Column("initiator_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_agreements_initiator_id_users", "users", ["initiator_id"], ["id"])
        batch_op.create_index("ix_agreements_initiator_id", ["initiator_id"])


def downgrade() -> None:
    with op.batch_alter_table("agreements") as batch_op:
        batch_op.drop_index("ix_agreements_initiator_id")
        batch_op.drop_constraint("fk_agreements_initiator_id_users", type_="foreignkey")
        batch_op.drop_column("initiator_id")
