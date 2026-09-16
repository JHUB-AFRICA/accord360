"""add external partner workspace identities and memberships

Revision ID: 20260915_partner_workspace
Revises: 20260915_templates_configuration
"""

from alembic import op
import sqlalchemy as sa


revision = "20260915_partner_workspace"
down_revision = "20260915_templates_configuration"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "partner_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("membership_role", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("joined_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["partner_id"], ["partners.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("partner_id", "user_id", name="uq_partner_memberships_partner_user"),
    )
    op.create_index("ix_partner_memberships_partner_id", "partner_memberships", ["partner_id"])
    op.create_index("ix_partner_memberships_user_id", "partner_memberships", ["user_id"])
    op.create_index("ix_partner_memberships_status", "partner_memberships", ["status"])
    op.create_table(
        "partner_invitations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=False),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("invited_by_id", sa.Integer(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["partner_id"], ["partners.id"]),
        sa.ForeignKeyConstraint(["invited_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_partner_invitations_partner_id", "partner_invitations", ["partner_id"])
    op.create_index("ix_partner_invitations_email", "partner_invitations", ["email"])
    op.create_index("ix_partner_invitations_token_hash", "partner_invitations", ["token_hash"])


def downgrade() -> None:
    op.drop_index("ix_partner_invitations_token_hash", table_name="partner_invitations")
    op.drop_index("ix_partner_invitations_email", table_name="partner_invitations")
    op.drop_index("ix_partner_invitations_partner_id", table_name="partner_invitations")
    op.drop_table("partner_invitations")
    op.drop_index("ix_partner_memberships_status", table_name="partner_memberships")
    op.drop_index("ix_partner_memberships_user_id", table_name="partner_memberships")
    op.drop_index("ix_partner_memberships_partner_id", table_name="partner_memberships")
    op.drop_table("partner_memberships")
