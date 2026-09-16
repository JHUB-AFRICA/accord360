"""add historical import provenance and review metadata

Revision ID: 20260916_import_review
Revises: 20260916_agreement_initiator
"""

from alembic import op
import sqlalchemy as sa


revision = "20260916_import_review"
down_revision = "20260916_agreement_initiator"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("agreements") as batch_op:
        batch_op.add_column(sa.Column("source_row_number", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("source_section", sa.String(length=240), nullable=True))
        batch_op.add_column(sa.Column("source_date_raw", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("source_type_raw", sa.String(length=160), nullable=True))
        batch_op.add_column(sa.Column("source_status_raw", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("source_purpose_raw", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("data_quality_status", sa.String(length=30), nullable=False, server_default="verified"))
        batch_op.add_column(sa.Column("data_quality_note", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("reviewed_by_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("reviewed_at", sa.DateTime(), nullable=True))
        batch_op.create_foreign_key("fk_agreements_reviewed_by_id_users", "users", ["reviewed_by_id"], ["id"])
        batch_op.create_index("ix_agreements_source_row_number", ["source_row_number"])
        batch_op.create_index("ix_agreements_data_quality_status", ["data_quality_status"])


def downgrade() -> None:
    with op.batch_alter_table("agreements") as batch_op:
        batch_op.drop_index("ix_agreements_data_quality_status")
        batch_op.drop_index("ix_agreements_source_row_number")
        batch_op.drop_constraint("fk_agreements_reviewed_by_id_users", type_="foreignkey")
        batch_op.drop_column("reviewed_at")
        batch_op.drop_column("reviewed_by_id")
        batch_op.drop_column("data_quality_note")
        batch_op.drop_column("data_quality_status")
        batch_op.drop_column("source_purpose_raw")
        batch_op.drop_column("source_status_raw")
        batch_op.drop_column("source_type_raw")
        batch_op.drop_column("source_date_raw")
        batch_op.drop_column("source_section")
        batch_op.drop_column("source_row_number")
