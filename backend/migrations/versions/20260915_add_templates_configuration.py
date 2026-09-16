"""add template library and system configuration

Revision ID: 20260915_templates_configuration
Revises: 20260915_partner_reviews
"""

from alembic import op
import sqlalchemy as sa


revision = "20260915_templates_configuration"
down_revision = "20260915_partner_reviews"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=240), nullable=False),
        sa.Column("agreement_type", sa.String(length=30), nullable=False),
        sa.Column("version", sa.String(length=30), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=True),
        sa.Column("stored_name", sa.String(length=255), nullable=True),
        sa.Column("mime_type", sa.String(length=120), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", "version", name="uq_templates_name_version"),
        sa.UniqueConstraint("stored_name"),
    )
    op.create_index("ix_templates_name", "templates", ["name"])
    op.create_index("ix_templates_agreement_type", "templates", ["agreement_type"])
    op.create_index("ix_templates_status", "templates", ["status"])
    with op.batch_alter_table("agreements") as batch_op:
        batch_op.add_column(sa.Column("template_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_agreements_template_id", "templates", ["template_id"], ["id"])
    op.create_table(
        "configuration_values",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_editable", sa.Boolean(), nullable=False),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_configuration_values_key", "configuration_values", ["key"])
    op.create_index("ix_configuration_values_category", "configuration_values", ["category"])
    op.create_table(
        "reference_data",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("label", sa.String(length=180), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category", "code", name="uq_reference_data_category_code"),
    )
    op.create_index("ix_reference_data_category", "reference_data", ["category"])


def downgrade() -> None:
    op.drop_index("ix_reference_data_category", table_name="reference_data")
    op.drop_table("reference_data")
    op.drop_index("ix_configuration_values_category", table_name="configuration_values")
    op.drop_index("ix_configuration_values_key", table_name="configuration_values")
    op.drop_table("configuration_values")
    op.drop_index("ix_templates_status", table_name="templates")
    op.drop_index("ix_templates_agreement_type", table_name="templates")
    op.drop_index("ix_templates_name", table_name="templates")
    op.drop_table("templates")
    with op.batch_alter_table("agreements") as batch_op:
        batch_op.drop_constraint("fk_agreements_template_id", type_="foreignkey")
        batch_op.drop_column("template_id")
