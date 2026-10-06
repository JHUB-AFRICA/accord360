"""Google Docs drafting integration — GOOGLE_DOCS_DRAFTING_BRIEF.md Phase A.

Adds templates.master_doc_id, agreements.template_copy_doc_id/
template_copy_url/renewal_of_id, and the agreement_drive_permissions table
that records every Drive permission grant so revocation never has to guess
via permissions.list.

Revision ID: 20260925_google_docs_drafting
Revises: 20260920_researcher_terminology
"""

from alembic import op
import sqlalchemy as sa


revision = "20260925_google_docs_drafting"
down_revision = "20260920_researcher_terminology"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("templates") as batch_op:
        batch_op.add_column(sa.Column("master_doc_id", sa.String(length=120), nullable=True))

    with op.batch_alter_table("agreements") as batch_op:
        batch_op.add_column(sa.Column("template_copy_doc_id", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("template_copy_url", sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column("renewal_of_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_agreements_renewal_of_id_agreements", "agreements", ["renewal_of_id"], ["id"]
        )

    op.create_table(
        "agreement_drive_permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agreement_id", sa.Integer(), sa.ForeignKey("agreements.id"), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=False),
        sa.Column("permission_id", sa.String(length=120), nullable=False),
        sa.Column("granted_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_agreement_drive_permissions_agreement_id",
        "agreement_drive_permissions",
        ["agreement_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_agreement_drive_permissions_agreement_id", table_name="agreement_drive_permissions")
    op.drop_table("agreement_drive_permissions")

    with op.batch_alter_table("agreements") as batch_op:
        batch_op.drop_constraint("fk_agreements_renewal_of_id_agreements", type_="foreignkey")
        batch_op.drop_column("renewal_of_id")
        batch_op.drop_column("template_copy_url")
        batch_op.drop_column("template_copy_doc_id")

    with op.batch_alter_table("templates") as batch_op:
        batch_op.drop_column("master_doc_id")
