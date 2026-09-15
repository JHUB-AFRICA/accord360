"""add dedicated correction records

Revision ID: 20260915_corrections
Revises: 20260915_partner_applications
"""

from alembic import op
import sqlalchemy as sa


revision = "20260915_corrections"
down_revision = "20260915_partner_applications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "corrections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("agreement_id", sa.Integer(), nullable=False),
        sa.Column("workflow_event_id", sa.Integer(), nullable=False),
        sa.Column("return_action", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("exact_item", sa.String(length=300), nullable=False),
        sa.Column("requested_change", sa.Text(), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("requested_by_id", sa.Integer(), nullable=False),
        sa.Column("assigned_to_id", sa.Integer(), nullable=True),
        sa.Column("response_text", sa.Text(), nullable=True),
        sa.Column("responded_by_id", sa.Integer(), nullable=True),
        sa.Column("responded_at", sa.DateTime(), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("resolved_by_id", sa.Integer(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["agreement_id"], ["agreements.id"]),
        sa.ForeignKeyConstraint(["workflow_event_id"], ["workflow_events.id"]),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["assigned_to_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["responded_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workflow_event_id"),
    )
    op.create_index("ix_corrections_agreement_id", "corrections", ["agreement_id"])
    op.create_index("ix_corrections_status", "corrections", ["status"])


def downgrade() -> None:
    op.drop_index("ix_corrections_status", table_name="corrections")
    op.drop_index("ix_corrections_agreement_id", table_name="corrections")
    op.drop_table("corrections")
