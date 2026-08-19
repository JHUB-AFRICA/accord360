from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .core.config import settings
from .db.base import Base
from .db.session import engine
from .logging_config import configure_logging
from .modules.agreements.router import router as agreements_router
from .modules.partners.router import router as partners_router
from .modules.users.router import auth_router, router as users_router
from .modules.workflows.router import dashboard_router, documents_router, me_router, notifications_router, reports_router
from .seed import seed

configure_logging()
logger = logging.getLogger("accord360.api")

settings.validate()
if settings.environment == "test":
    Base.metadata.create_all(bind=engine)
if settings.seed_demo_data:
    seed(reset=False, demo=True)

app = FastAPI(
    title="Accord 360 API",
    description="MoU / CRA / CA lifecycle, workflow, M&E and partnership performance platform.",
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    started = time.perf_counter()
    response = None
    try:
        response = await call_next(request)
        return response
    except Exception:
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        logger.exception(
            "request_failed request_id=%s method=%s path=%s duration_ms=%s",
            request_id,
            request.method,
            request.url.path,
            duration_ms,
        )
        raise
    finally:
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        status_code = response.status_code if response is not None else 500
        logger.info(
            "request request_id=%s method=%s path=%s status=%s duration_ms=%s",
            request_id,
            request.method,
            request.url.path,
            status_code,
            duration_ms,
        )
        if response is not None:
            response.headers["X-Request-ID"] = request_id

for router in [auth_router, users_router, partners_router, agreements_router, documents_router, me_router, dashboard_router, notifications_router, reports_router]:
    app.include_router(router, prefix="/api")

logger.info(
    "application_ready environment=%s database=%s object_storage=%s log_level=%s",
    settings.environment,
    "postgresql" if settings.database_url.startswith(("postgres://", "postgresql://", "postgresql+")) else "sqlite",
    settings.storage_enabled,
    settings.log_level,
)


@app.get("/")
def root():
    return {"name": settings.app_name, "status": "running", "docs": "/docs", "version": "1.2.0"}


@app.get("/health")
def health():
    """Report application and database readiness for Compose/load balancers."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        logger.exception("database_healthcheck_failed")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "environment": settings.environment, "database": "unavailable"},
        )

    return {"status": "healthy", "environment": settings.environment, "database": "connected"}
