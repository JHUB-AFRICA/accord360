"""Phase 1 rebuild: 4-role/9-status core data model

REBUILD_BRIEF.md Section 2 — replaces the old 11-role/17-stage/multi-model
schema with the new Agreement/AgreementVersion/Comment/ProgressUpdate/
Template/FieldDefinition model. This is a pre-production rebuild: historical
data in the tables being replaced is not migrated, per REBUILD_BRIEF.md's
"you don't need to migrate historical data" instruction (Section 2, migration
task item 6).

Revision ID: 20260920_phase1_core_model
Revises: 20260916_import_review
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260920_phase1_core_model"
down_revision = "20260916_import_review"
branch_labels = None
depends_on = None


# Tables superseded by the new model (REBUILD_BRIEF.md Section 1 and Section
# 2 Acceptance Criteria: Deliverable, ValueRecord, ScorecardDefinition,
# ScorecardSnapshot, Correction and the old Document model must not be left
# dangling). The partner_* "external partner portal" tables are also
# orphaned leftovers from the Phase 0 removal (no models reference them any
# more) and are cleaned up here too.
_DROP_ORDER = [
    "deliverables",
    "value_records",
    "scorecard_snapshots",
    "scorecard_definitions",
    "corrections",
    "partner_application_documents",
    "partner_applications",
    "partner_memberships",
    "partner_invitations",
    "documents",
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for table in _DROP_ORDER:
        if table in existing_tables:
            op.drop_table(table)

    if "workflow_events" in existing_tables:
        op.drop_table("workflow_events")

    # notifications survives this rebuild but references agreements; PostgreSQL
    # refuses to drop a table that a surviving FK points at (SQLite does not).
    notifications_fk_dropped = False
    if "notifications" in existing_tables and bind.dialect.name != "sqlite":
        for fk in inspector.get_foreign_keys("notifications"):
            if fk["referred_table"] == "agreements" and fk.get("name"):
                op.drop_constraint(fk["name"], "notifications", type_="foreignkey")
                notifications_fk_dropped = True

    if "agreements" in existing_tables:
        op.drop_table("agreements")
    if "templates" in existing_tables:
        op.drop_table("templates")

    # --- New/rebuilt tables -------------------------------------------------
    op.create_table(
        "templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_type", sa.String(length=120), nullable=False),
        sa.Column("file", sa.String(length=500), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_templates_document_type", "templates", ["document_type"])

    op.create_table(
        "agreements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=False),
        sa.Column("department", sa.String(length=180), nullable=False),
        sa.Column("researcher_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="draft_generated"),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("expiry_alert_date", sa.Date(), nullable=True),
        sa.Column("expiry_notified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["partner_id"], ["partners.id"]),
        sa.ForeignKeyConstraint(["researcher_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agreements_researcher_id", "agreements", ["researcher_id"])
    op.create_index("ix_agreements_status", "agreements", ["status"])

    if notifications_fk_dropped:
        op.create_foreign_key(
            "notifications_agreement_id_fkey",
            "notifications",
            "agreements",
            ["agreement_id"],
            ["id"],
        )

    op.create_table(
        "workflow_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("agreement_id", sa.Integer(), nullable=False),
        sa.Column("from_stage", sa.String(length=80), nullable=True),
        sa.Column("to_stage", sa.String(length=80), nullable=False),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("actor_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["agreement_id"], ["agreements.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workflow_events_agreement_id", "workflow_events", ["agreement_id"])

    op.create_table(
        "agreement_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("agreement_id", sa.Integer(), nullable=False),
        sa.Column("file", sa.String(length=500), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("status_at_time", sa.String(length=40), nullable=False),
        sa.Column("is_final", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["agreement_id"], ["agreements.id"]),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agreement_versions_agreement_id", "agreement_versions", ["agreement_id"])

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

    op.create_table(
        "progress_updates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("agreement_id", sa.Integer(), nullable=False),
        sa.Column("quarter", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("submitted_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["agreement_id"], ["agreements.id"]),
        sa.ForeignKeyConstraint(["submitted_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_progress_updates_agreement_id", "progress_updates", ["agreement_id"])

    op.create_table(
        "field_definitions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("field_name", sa.String(length=120), nullable=False),
        sa.Column("label", sa.String(length=240), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("field_name"),
    )

    # Researcher is the initiating internal role in the current specification.
    op.execute("UPDATE users SET role = 'researcher' WHERE role = 'champion'")


def downgrade() -> None:
    # Best-effort structural downgrade; data created under the Phase 1 model
    # is not preserved (pre-production rebuild, per REBUILD_BRIEF.md).
    op.drop_table("field_definitions")
    op.drop_index("ix_progress_updates_agreement_id", table_name="progress_updates")
    op.drop_table("progress_updates")
    op.drop_index("ix_comments_version_id", table_name="comments")
    op.drop_table("comments")
    op.drop_index("ix_agreement_versions_agreement_id", table_name="agreement_versions")
    op.drop_table("agreement_versions")
    op.drop_index("ix_workflow_events_agreement_id", table_name="workflow_events")
    op.drop_table("workflow_events")
    op.drop_index("ix_agreements_status", table_name="agreements")
    op.drop_index("ix_agreements_researcher_id", table_name="agreements")
    op.drop_table("agreements")
    op.drop_index("ix_templates_document_type", table_name="templates")
    op.drop_table("templates")
