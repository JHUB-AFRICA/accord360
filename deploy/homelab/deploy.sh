#!/usr/bin/env bash
# Deploy the current working tree (tracked files only; never venv/.env) to the homelab as a user systemd service (no Docker, no sudo).
# Usage (from repo root): deploy/homelab/deploy.sh [ssh-host]
set -euo pipefail
HOST="${1:-homelab}"
REMOTE_DIR='~/apps/accord360'
cd "$(git rev-parse --show-toplevel)"

echo "==> Building frontend (same-origin /api)"
(cd frontend && VITE_API_URL=/api VITE_USE_MOCK_API=false npm run build)

echo "==> Shipping tracked backend files (working-tree versions) + frontend/dist"
ssh "$HOST" "mkdir -p $REMOTE_DIR"
git ls-files -z backend | tar --null -T - -c | ssh "$HOST" "tar -x -C $REMOTE_DIR"
tar -c frontend/dist deploy/homelab | ssh "$HOST" "rm -rf $REMOTE_DIR/frontend/dist && tar -x -C $REMOTE_DIR"

echo "==> Remote setup"
ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
cd ~/apps/accord360/backend
export PATH="$HOME/.local/bin:$PATH"
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
[ -x .venv/bin/python ] || uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python -q -r requirements.txt
if [ ! -f .env ]; then
  cat > .env <<ENV
APP_NAME=Accord 360
ENVIRONMENT=demo
SECRET_KEY=$(openssl rand -hex 32)
DATABASE_URL=sqlite:///./accord360.db
UPLOAD_DIR=uploads
OBJECT_STORAGE_ENABLED=false
EMAIL_ENABLED=false
EMAIL_PROVIDER=console
SEED_DEMO_DATA=true
CORS_ORIGINS=http://localhost:8095
LOG_LEVEL=INFO
ENV
  chmod 600 .env
fi
mkdir -p ~/.config/systemd/user
cp ../deploy/homelab/accord360-demo.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable accord360-demo.service >/dev/null
systemctl --user restart accord360-demo.service
REMOTE
echo "==> Done: http://$HOST:8095 (or the host's LAN/Tailscale address)"
