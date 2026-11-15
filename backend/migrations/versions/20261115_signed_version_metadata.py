"""Store metadata for immutable signed agreement files.

Revision ID: 20261115_signed_version_metadata
Revises: 20261114_notification_contract
"""

from alembic import op
import sqlalchemy as sa

revision = "20261115_signed_version_metadata"
down_revision = "20261114_notification_contract"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agreement_versions", sa.Column("original_filename", sa.String(length=255), nullable=True))
    op.add_column("agreement_versions", sa.Column("content_type", sa.String(length=127), nullable=True))
    op.add_column("agreement_versions", sa.Column("file_size", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("agreement_versions", "file_size")
    op.drop_column("agreement_versions", "content_type")
    op.drop_column("agreement_versions", "original_filename")
