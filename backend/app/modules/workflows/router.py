from .dashboard import router as dashboard_router
from .notifications import router as notifications_router
from .reports import router as reports_router

# NOTE(rebuild-phase1): the old documents_router (Document model) was removed
# per REBUILD_BRIEF.md Section 2 — AgreementVersion upload/download endpoints
# are Phase 2/3 work (document generation engine, Section 3/4).
__all__ = ["dashboard_router", "notifications_router", "reports_router"]
