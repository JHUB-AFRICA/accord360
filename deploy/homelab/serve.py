"""Homelab demo entrypoint: serves the Accord 360 API and the built frontend on one port.

Run from backend/:  python -m uvicorn serve:app --app-dir ../deploy/homelab
Keeps app/main.py untouched; only used for the single-process demo deployment.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.main import app

DIST = Path(os.environ.get("FRONTEND_DIST_DIR", "../frontend/dist")).resolve()

# Let the SPA own "/" instead of the API's JSON status route (/health still exists).
app.router.routes = [r for r in app.router.routes if getattr(r, "path", None) != "/"]
app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="frontend-assets")


@app.get("/{full_path:path}", include_in_schema=False)
def spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")
    candidate = (DIST / full_path).resolve()
    if full_path and candidate.is_file() and DIST in candidate.parents:
        return FileResponse(candidate)
    return FileResponse(DIST / "index.html")
