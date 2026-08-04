#!/usr/bin/env bash
set -e
(cd backend && python -m alembic upgrade head && python -m uvicorn app.main:app --reload) &
BACKEND_PID=$!
(cd frontend && npm run dev) &
FRONTEND_PID=$!
trap 'kill $BACKEND_PID $FRONTEND_PID' EXIT
wait
