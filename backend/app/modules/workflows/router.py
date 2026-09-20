from .dashboard import router as dashboard_router
from .documents import router as documents_router
from .notifications import router as notifications_router
from .reports import router as reports_router

__all__ = ["dashboard_router", "documents_router", "notifications_router", "reports_router"]
