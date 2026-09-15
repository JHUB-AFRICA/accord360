"""add partner review decision history

Revision ID: 20260915_partner_reviews
Revises: 20260915_corrections
"""

from alembic import op
import sqlalchemy as sa


revision = "20260915_partner_reviews"
down_revision = "20260915_corrections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "partner_review_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), nullable=False),
        sa.Column("old_status", sa.String(length=40), nullable=True),
        sa.Column("new_status", sa.String(length=40), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["partner_id"], ["partners.id"]),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_partner_review_events_partner_id", "partner_review_events", ["partner_id"])


def downgrade() -> None:
    op.drop_index("ix_partner_review_events_partner_id", table_name="partner_review_events")
    op.drop_table("partner_review_events")
