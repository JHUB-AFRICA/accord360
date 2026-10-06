"""Google Docs drafting integration — GOOGLE_DOCS_DRAFTING_BRIEF.md Phase D.

Retires the docx-template-merge machinery: templates.file becomes optional
(it's now just Linkages' own reference copy, never parsed by Accord 360),
and the comments table is dropped — Legal's comments live natively in the
Google Doc; Accord 360 only logs that a "returned for corrections" event
happened, via workflow_events.comment.

Revision ID: 20260925b_google_docs_phase_d
Revises: 20260925_google_docs_drafting
"""

from alembic import op
import sqlalchemy as sa


revision = "20260925b_google_docs_phase_d"
down_revision = "20260925_google_docs_drafting"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("templates") as batch_op:
        batch_op.alter_column("file", existing_type=sa.String(length=500), nullable=True)

    op.drop_index("ix_comments_version_id", table_name="comments")
    op.drop_table("comments")


def downgrade() -> None:
    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("version_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("section_reference", sa.String(length=300), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["version_id"], ["agreement_versions.id"]),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_comments_version_id", "comments", ["version_id"])

    with op.batch_alter_table("templates") as batch_op:
        batch_op.alter_column("file", existing_type=sa.String(length=500), nullable=False)
