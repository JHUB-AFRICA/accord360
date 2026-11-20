# Accord 360 — deployment package

Everything needed to run Accord 360 on one Linux server. No source code required:
Docker pulls the images and wires the four containers together.

| Container | Image | Role |
|---|---|---|
| `frontend` | `jhubafrica/accord360-app:frontend-<tag>` | React app + nginx; proxies `/api` to the backend; accepts uploads up to 30 MB |
| `backend` | `jhubafrica/accord360-app:backend-<tag>` | FastAPI; runs DB migrations on start; talks to Google Drive |
| `database` | `postgres:16-alpine` | PostgreSQL (named volume `accord360_postgres`) |
| `objectstore` | `rustfs/rustfs:1.0.6` | S3-compatible storage for signed agreements uploaded by Linkages (named volume `accord360_objects`) |

```text
browser -> HTTPS reverse proxy -> frontend:80 --/api--> backend:8000 -> database:5432
                                                                    \-> objectstore:9000
```

## One-command install

Requirements: Linux, Docker Engine with the Compose plugin, outbound access to Docker Hub.

```bash
./install.sh
```

That creates `.env` with freshly generated secrets, pulls the images, starts all four
containers in dependency order, waits until every one is healthy, and prints the URL.
It is safe to re-run (an existing `.env` is kept; data lives in named volumes).

Typical production invocation:

```bash
ACCORD360_PUBLIC_URL=https://accord360.jhubafrica.com \
ACCORD360_GOOGLE_KEY_FILE=/path/to/service-account.json \
ACCORD360_GOOGLE_FOLDER_ID=<shared-drive-folder-id> \
./install.sh
```

Optional inputs: `ACCORD360_DEMO_SIGNUP=true` (email + office self-signup, demos only),
`ACCORD360_RELEASE_TAG=sha-<commit>` (pin a release), `ACCORD360_IMAGE_REPOSITORY`,
`ACCORD360_SKIP_PULL=1` (images already loaded with `docker load`).

Then point the public domain's HTTPS reverse proxy at **`http://127.0.0.1:8080`** (the
**frontend**). Do not point it at port 8000: that is the raw backend API and only shows
`{"name":"Accord 360","status":"running",...}`.

## Image tags

GitHub Actions publishes both images to the single repository `jhubafrica/accord360-app`
on every merge to `main`, always as a matching pair:

```text
backend-sha-<full-commit>    frontend-sha-<full-commit>     immutable, preferred for production
backend-v1.0                 frontend-v1.0                  moves with each release
backend-latest               frontend-latest
v1.0                         (alias of the backend image only — not the frontend)
```

`RELEASE_TAG` in `.env` selects the suffix for both (`v1.0` or `sha-<full-commit>`).

## First use

1. Sign up (if `ALLOW_DEMO_SIGNUP=true`) or create staff with
   `docker compose exec backend python -m app.bootstrap --email ... --name ... --role linkages`.
2. As Linkages, open **Templates** and add each template's Google Doc ID, then activate it.
   The Google Docs must be shared with the service account (its address is `client_email`
   in the key file) as Editor, inside the Shared Drive in `GOOGLE_DRIVE_FOLDER_ID`.
3. Researchers can now start agreements; the Doc is copied and shared automatically.

Notes:
- The service account should be a **Manager** of the Shared Drive, otherwise Google refuses
  the "viewers cannot copy/download" setting (logged as a warning; everything else works).
- Shared Drive members can open every agreement Doc; review that membership.
- Object storage replaces the old local-volume uploads. To keep local uploads, set
  `OBJECT_STORAGE_ENABLED=false`; to use external S3, set the `AWS_*` variables in `.env`.
- `SEED_DEMO_DATA` must stay `false` in production (the backend refuses to start otherwise).

## Operations

```bash
docker compose ps
docker compose logs -f backend frontend
docker compose pull && docker compose up -d --wait   # upgrade after changing RELEASE_TAG
docker compose down                                   # stop, keep data
```

Never use `docker compose down -v` unless deleting the database, uploads and stored
agreements is intended.

Backup:

```bash
set -a; . ./.env; set +a
mkdir -p backups
docker compose exec -T database pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "backups/accord360-$(date +%Y%m%d-%H%M%S).sql.gz"
docker run --rm -v "$(basename "$PWD")_accord360_objects:/data:ro" -v "$PWD/backups:/backup" alpine \
  tar czf "/backup/objects-$(date +%Y%m%d-%H%M%S).tgz" -C /data .
```

Copy backups off the server and periodically test a restore.
