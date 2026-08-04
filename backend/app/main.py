from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .db.base import Base
from .db.session import engine
from .modules.agreements.router import router as agreements_router
from .modules.partners.router import router as partners_router
from .modules.users.router import auth_router, router as users_router
from .modules.workflows.router import dashboard_router, documents_router, me_router, notifications_router, reports_router
from .seed import seed

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

for router in [auth_router, users_router, partners_router, agreements_router, documents_router, me_router, dashboard_router, notifications_router, reports_router]:
    app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {"name": settings.app_name, "status": "running", "docs": "/docs", "version": "1.2.0"}


@app.get("/health")
def health():
    return {"status": "healthy", "environment": settings.environment}
