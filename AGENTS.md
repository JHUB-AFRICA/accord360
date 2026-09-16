# AGENTS.md

Accord 360 is a monorepo with two independent apps: `backend/` (FastAPI + SQLAlchemy + Alembic) and `frontend/` (React + Vite, plain JS/JSX). An agent must not assume one build tool manages both.

## Backend (`backend/`)

- Run everything from `backend/`. Env comes from `backend/.env` (auto-loaded by `app/core/config.py`); copy `.env.example` first.
- Start: `python -m alembic upgrade head` then `python -m uvicorn app.main:app --reload` (port 8000, docs at `/docs`).
- Demo users/agreements are seeded automatically at import (main.py:30, `SEED_DEMO_DATA` defaults true). Reset them with `python -m app.seed --reset`. Demo credentials and role→route mapping are in `README.md`.
- Tests: `python -m pytest -q` from `backend/`. When running from anywhere else, `PYTHONPATH=.` is required (README shows `$env:PYTHONPATH="."` on Windows). There is no `conftest.py`/`pytest.ini`; each test module sets `ENVIRONMENT=test`, `DATABASE_URL=sqlite:///./test_accord360.db` at the top before importing `app.main`, and relies on demo seed users.
- Migrations: after editing SQLAlchemy models run `python -m alembic revision --autogenerate -m "..."`, review the generated file, then `upgrade head`. Note `app/main.py` only uses `Base.metadata.create_all()` when `ENVIRONMENT=test`; never rely on it otherwise.
- Feature modules live in `app/modules/{users,partners,agreements,workflows,ai}/`. Top-level `app/models.py`, `app/schemas.py`, `app/services.py`, `app/database.py`, `app/config.py`, `app/security.py` are **compatibility re-export shims** — use the `app.db` / `app.core` / `app.modules` paths in new code.
- Python **3.13** is the supported version (Dockerfile and CI pin it). Repo docs report that the pinned FastAPI/Starlette stack hangs (AnyIO threadpool) on Python 3.14 — do not "fix" this by bumping dependencies.
- Three compose files exist, don't mix them: root `docker-compose.yml` (frontend :8080 + backend + postgres, `env_file: ./backend/.env`), `backend/docker-compose.yml` (backend + postgres + MinIO; `cp .env.docker.example .env.docker`, uses service hostnames `database` and `minio`, not localhost), and `backend/accord360-deployment/` (deployment variant).
- CI runs only when backend paths change; the image is built/pushed to Docker Hub on `main`. There is no frontend CI.

## Frontend (`frontend/`)

- Use `npm`, not yarn/pnpm (`npm ci` per lockfile). Dev server: `npm run dev` (port 5173). Copy `.env.example` to `.env`; `VITE_API_URL=http://127.0.0.1:8000/api` and `VITE_USE_MOCK_API=false` are enforced by validation.
- The verification gate is `npm run check` (validate → syntax → mock-smoke → build). Lint/typecheck via `npm run check` output. `npm run build` runs validate first, so a failing build is often a validation failure, not a compile error.
- **All HTTP must go through `src/lib/api.js` / `src/lib/backend.js`.** `scripts/validate.mjs` fails the build if any file other than `src/lib/api.js`, `src/lib/backend.js`, or `src/lib/mockApi.js` calls `api`/`apiJson`/`downloadFile` directly. It also hard-fails on missing "required" endpoint fragments in `src/lib/backend.js` and on "unsupported" ones — keep that endpoint list in sync with the backend. The implemented API contract is `backend/API_ENDPOINTS.md` and `frontend/BACKEND_API_CONTRACT.md`.
- `npm run test:mock` drives the full role-based workflow against the in-browser mock (`src/lib/mockApi.js`), not the real backend.

## Gotchas

- Root `.gitignore` ignores `.venv/` but **not** `backend/venv/`, and a populated `backend/venv/` exists untracked — never commit or include it.
- Backend authorization (`app/access.py`, `app/deps.py`) is the security boundary; the frontend UI is not. Do not "simplify" by trusting hidden UI controls or adding endpoints that skip scope checks.
- Doc files (`docs/`, various `*_REPORT.md`, `TESTING_CHECKLIST.md`) are working notes; treat code/config as the source of truth when they conflict.