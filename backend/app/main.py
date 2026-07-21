from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import agreements, auth, dashboard, documents, me, monitoring, notifications, partners, reports, users
from .seed import seed

Base.metadata.create_all(bind=engine)
seed(reset=False, demo=True)

app = FastAPI(
    title="Accord 360 API",
    description="MoU / CRA / CA lifecycle, workflow, M&E and partnership performance platform.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


for router in [auth.router, users.router, partners.router, agreements.router, documents.router, me.router, monitoring.router, dashboard.router, notifications.router, reports.router]:
    app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {"name": settings.app_name, "status": "running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}
