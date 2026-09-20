"""Rename the initiating agreement role and ownership column to researcher.

The Phase 2 workflow uses Researcher for the staff member who submits the
structured intake. Linkages then uploads the legal draft for Legal review.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260920_researcher_terminology"
down_revision = "20260920_phase1_core_model"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("agreements")}

    if "champion_id" in columns and "researcher_id" not in columns:
        with op.batch_alter_table("agreements") as batch_op:
            batch_op.alter_column("champion_id", new_column_name="researcher_id")
        op.drop_index("ix_agreements_champion_id", table_name="agreements")
        op.create_index("ix_agreements_researcher_id", "agreements", ["researcher_id"])

    op.execute("UPDATE users SET role = 'researcher' WHERE role = 'champion'")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("agreements")}

    op.execute("UPDATE users SET role = 'champion' WHERE role = 'researcher'")
    if "researcher_id" in columns and "champion_id" not in columns:
        op.drop_index("ix_agreements_researcher_id", table_name="agreements")
        with op.batch_alter_table("agreements") as batch_op:
            batch_op.alter_column("researcher_id", new_column_name="champion_id")
        op.create_index("ix_agreements_champion_id", "agreements", ["champion_id"])
