"""Separate the Linkages and Legal review stages.

Statuses: pending_legal_review / pending_legal_verification -> legal_review,
returned_for_corrections -> returned_to_researcher (agreement.status is a
plain string column, so this is a data migration). Also adds the approval
record columns Linkages sees after Legal approves.

Revision ID: 20261111_linkages_legal_split
Revises: 20260925b_google_docs_phase_d
"""

from alembic import op
import sqlalchemy as sa


revision = "20261111_linkages_legal_split"
down_revision = "20260925b_google_docs_phase_d"
branch_labels = None
depends_on = None

_MAP = {
    "pending_legal_review": "legal_review",
    "pending_legal_verification": "legal_review",
    "returned_for_corrections": "returned_to_researcher",
}
_REVERSE = {"legal_review": "pending_legal_review", "returned_to_researcher": "returned_for_corrections"}
# (table, column) pairs that hold a status name.
_COLUMNS = [("agreements", "status"), ("workflow_events", "from_stage"), ("workflow_events", "to_stage")]


def _remap(mapping: dict[str, str]) -> None:
    for table, column in _COLUMNS:
        for old, new in mapping.items():
            op.execute(sa.text(f"UPDATE {table} SET {column} = :new WHERE {column} = :old").bindparams(new=new, old=old))


def upgrade() -> None:
    with op.batch_alter_table("agreements") as batch_op:
        batch_op.add_column(sa.Column("approved_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("approved_by_name", sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column("approved_doc_modified_at", sa.String(length=40), nullable=True))
    _remap(_MAP)


def downgrade() -> None:
    _remap(_REVERSE)
    with op.batch_alter_table("agreements") as batch_op:
        batch_op.drop_column("approved_doc_modified_at")
        batch_op.drop_column("approved_by_name")
        batch_op.drop_column("approved_at")
