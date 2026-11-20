#!/usr/bin/env sh
# One-command install/upgrade for Accord 360.
#
#   ./install.sh
#
# Optional (non-interactive) inputs:
#   ACCORD360_PUBLIC_URL=https://accord360.example.com   public URL (CORS)
#   ACCORD360_GOOGLE_KEY_FILE=/path/to/service-account.json
#   ACCORD360_GOOGLE_FOLDER_ID=<shared drive folder id>
#   ACCORD360_DEMO_SIGNUP=true                            enable email+office signup
#   ACCORD360_RELEASE_TAG=sha-<commit>                    pin a release
#   ACCORD360_IMAGE_REPOSITORY=<repo>                     use a different image repo
#   ACCORD360_SKIP_PULL=1                                 images already loaded locally
#
# Safe to re-run: an existing .env is never overwritten, only updated by the
# inputs above, and data lives in named Docker volumes.
set -eu
cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || { echo "Docker is required: https://docs.docker.com/engine/install/" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 (the 'docker compose' plugin) is required." >&2; exit 1; }

set_var() { # set_var KEY VALUE  (no sed: values may contain any character)
  { grep -v "^$1=" .env || true; printf '%s=%s\n' "$1" "$2"; } > .env.tmp && mv .env.tmp .env
}
get_var() { grep "^$1=" .env | head -n1 | cut -d= -f2-; }
random() { od -An -N24 -tx1 /dev/urandom | tr -d ' \n'; }

if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  echo "Created .env with freshly generated secrets."
fi
for key in SECRET_KEY POSTGRES_PASSWORD OBJECT_STORAGE_ROOT_PASSWORD; do
  [ "$(get_var "$key")" = "__GENERATE__" ] && set_var "$key" "$(random)"
done

[ -n "${ACCORD360_PUBLIC_URL:-}" ] && set_var CORS_ORIGINS "${ACCORD360_PUBLIC_URL%/}"
[ -n "${ACCORD360_RELEASE_TAG:-}" ] && set_var RELEASE_TAG "$ACCORD360_RELEASE_TAG"
[ -n "${ACCORD360_IMAGE_REPOSITORY:-}" ] && set_var IMAGE_REPOSITORY "$ACCORD360_IMAGE_REPOSITORY"
[ -n "${ACCORD360_DEMO_SIGNUP:-}" ] && set_var ALLOW_DEMO_SIGNUP "$ACCORD360_DEMO_SIGNUP"
if [ -n "${ACCORD360_GOOGLE_KEY_FILE:-}" ]; then
  command -v python3 >/dev/null 2>&1 || { echo "python3 is needed to read the Google key file." >&2; exit 1; }
  key_json=$(python3 -c 'import json,sys;print(json.dumps(json.load(open(sys.argv[1]))))' "$ACCORD360_GOOGLE_KEY_FILE")
  set_var GOOGLE_SERVICE_ACCOUNT_JSON "'$key_json'"
  set_var GOOGLE_DRIVE_ENABLED true
  [ -n "${ACCORD360_GOOGLE_FOLDER_ID:-}" ] && set_var GOOGLE_DRIVE_FOLDER_ID "$ACCORD360_GOOGLE_FOLDER_ID"
fi

if [ "$(get_var GOOGLE_DRIVE_ENABLED)" != "true" ]; then
  echo "NOTE: Google Drive is not configured; drafting documents and partner sharing will not work."
  echo "      Re-run with ACCORD360_GOOGLE_KEY_FILE=... ACCORD360_GOOGLE_FOLDER_ID=... ./install.sh"
fi

if [ -z "${ACCORD360_SKIP_PULL:-}" ]; then
  echo "Pulling images..."
  docker compose pull
fi
echo "Starting Accord 360 (database, object storage, backend, frontend)..."
docker compose up -d --wait --remove-orphans

port=$(get_var FRONTEND_PORT)
echo
docker compose ps
echo
echo "Accord 360 is running:  http://127.0.0.1:${port}/   (API docs: /docs via the backend port)"
echo "Put an HTTPS reverse proxy in front of 127.0.0.1:${port} for the public domain."
