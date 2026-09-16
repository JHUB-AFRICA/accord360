"""add versioned scorecard definitions and immutable snapshots

Revision ID: 20260916_scorecards
Revises: 20260915_partner_workspace
"""

from alembic import op
import sqlalchemy as sa


revision = "20260916_scorecards"
down_revision = "20260915_partner_workspace"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scorecard_definitions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("version", sa.String(length=30), nullable=False),
        sa.Column("weights_json", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
    )
    op.create_index("ix_scorecard_definitions_is_active", "scorecard_definitions", ["is_active"])
    op.create_table(
        "scorecard_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agreement_id", sa.Integer(), nullable=False),
        sa.Column("definition_id", sa.Integer(), nullable=False),
        sa.Column("overall", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("components_json", sa.Text(), nullable=False),
        sa.Column("source_updated_at", sa.DateTime(), nullable=False),
        sa.Column("calculated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["agreement_id"], ["agreements.id"]),
        sa.ForeignKeyConstraint(["definition_id"], ["scorecard_definitions.id"]),
        sa.ForeignKeyConstraint(["calculated_by_id"], ["users.id"]),
    )
    op.create_index("ix_scorecard_snapshots_agreement_id", "scorecard_snapshots", ["agreement_id"])
    op.create_index("ix_scorecard_snapshots_definition_id", "scorecard_snapshots", ["definition_id"])


def downgrade() -> None:
    op.drop_index("ix_scorecard_snapshots_definition_id", table_name="scorecard_snapshots")
    op.drop_index("ix_scorecard_snapshots_agreement_id", table_name="scorecard_snapshots")
    op.drop_table("scorecard_snapshots")
    op.drop_index("ix_scorecard_definitions_is_active", table_name="scorecard_definitions")
    op.drop_table("scorecard_definitions")
