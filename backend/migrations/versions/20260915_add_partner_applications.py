"""add public partner applications

Revision ID: 20260915_partner_applications
Revises: c2b54ab4c7d3
"""

from alembic import op
import sqlalchemy as sa


revision = "20260915_partner_applications"
down_revision = "c2b54ab4c7d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "partner_applications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("reference_number", sa.String(length=60), nullable=False),
        sa.Column("institution_name", sa.String(length=240), nullable=False),
        sa.Column("institution_type", sa.String(length=120), nullable=False),
        sa.Column("country", sa.String(length=100), nullable=False),
        sa.Column("region", sa.String(length=120), nullable=True),
        sa.Column("website", sa.String(length=300), nullable=False),
        sa.Column("registration_number", sa.String(length=160), nullable=True),
        sa.Column("contact_name", sa.String(length=160), nullable=False),
        sa.Column("job_title", sa.String(length=160), nullable=False),
        sa.Column("official_email", sa.String(length=200), nullable=False),
        sa.Column("phone", sa.String(length=60), nullable=False),
        sa.Column("collaboration_area", sa.Text(), nullable=False),
        sa.Column("strategic_alignment", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("consent_at", sa.DateTime(), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(), nullable=True),
        sa.Column("verification_token_hash", sa.String(length=64), nullable=True),
        sa.Column("verification_token_expires_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("reference_number"),
        sa.UniqueConstraint("verification_token_hash"),
    )
    op.create_index("ix_partner_applications_reference_number", "partner_applications", ["reference_number"], unique=True)
    op.create_index("ix_partner_applications_official_email", "partner_applications", ["official_email"])
    op.create_index("ix_partner_applications_status", "partner_applications", ["status"])
    op.create_index("ix_partner_applications_verification_token_hash", "partner_applications", ["verification_token_hash"], unique=True)
    op.create_table(
        "partner_application_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("stored_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["partner_applications.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stored_name"),
    )
    op.create_index("ix_partner_application_documents_application_id", "partner_application_documents", ["application_id"])


def downgrade() -> None:
    op.drop_index("ix_partner_application_documents_application_id", table_name="partner_application_documents")
    op.drop_table("partner_application_documents")
    op.drop_index("ix_partner_applications_verification_token_hash", table_name="partner_applications")
    op.drop_index("ix_partner_applications_status", table_name="partner_applications")
    op.drop_index("ix_partner_applications_official_email", table_name="partner_applications")
    op.drop_index("ix_partner_applications_reference_number", table_name="partner_applications")
    op.drop_table("partner_applications")
