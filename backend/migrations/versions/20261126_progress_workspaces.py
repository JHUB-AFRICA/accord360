"""Add agreement progress Sheet workspaces and immutable submissions."""
from alembic import op
import sqlalchemy as sa

revision = "20261126_progress_workspaces"
down_revision = "20261115_signed_version_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "progress_workspaces",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agreement_id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False),
        sa.Column("spreadsheet_file_id", sa.String(length=120), nullable=True),
        sa.Column("spreadsheet_url", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("researcher_permission_id", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["agreement_id"], ["agreements.id"]),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"]),
        sa.UniqueConstraint("agreement_id"),
        sa.UniqueConstraint("spreadsheet_file_id"),
    )
    op.create_index("ix_progress_workspaces_status", "progress_workspaces", ["status"])
    op.create_table(
        "progress_submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agreement_id", sa.Integer(), nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("reporting_period", sa.String(length=30), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column("submitted_by_id", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("spreadsheet_modified_time", sa.String(length=50), nullable=True),
        sa.Column("snapshot_storage_key", sa.String(length=500), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="submitted"),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["agreement_id"], ["agreements.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["progress_workspaces.id"]),
        sa.ForeignKeyConstraint(["submitted_by_id"], ["users.id"]),
        sa.UniqueConstraint("idempotency_key"),
        sa.UniqueConstraint("agreement_id", "reporting_period", "sequence_number", name="uq_progress_submission_sequence"),
    )
    op.create_index("ix_progress_submissions_agreement_id", "progress_submissions", ["agreement_id"])
    op.create_index("ix_progress_submissions_workspace_id", "progress_submissions", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("ix_progress_submissions_workspace_id", table_name="progress_submissions")
    op.drop_index("ix_progress_submissions_agreement_id", table_name="progress_submissions")
    op.drop_table("progress_submissions")
    op.drop_index("ix_progress_workspaces_status", table_name="progress_workspaces")
    op.drop_table("progress_workspaces")
