# Accord 360 — Server Deployment Guide

For the DevOps engineer. Goal: get Accord 360 from Docker Hub running on a server, behind HTTPS, with one command.

## What you are deploying

Four containers. Two are our own images on Docker Hub; two are standard public images.

| Container | Image | Source |
|---|---|---|
| `frontend` | `jhubafrica/accord360-app:frontend-<tag>` | Docker Hub (ours) |
| `backend` | `jhubafrica/accord360-app:backend-<tag>` | Docker Hub (ours) |
| `database` | `postgres:16-alpine` | Docker Hub (public) |
| `objectstore` | `rustfs/rustfs:1.0.6` | Docker Hub (public) |

Both of our images live in the **same** repository, `jhubafrica/accord360-app`, separated by tag prefix. Always deploy the matching pair (same `<tag>`):

```text
backend-sha-<full-commit>    frontend-sha-<full-commit>    <- pinned release (recommended)
backend-v1.0                 frontend-v1.0                 <- moves with each release
```

(`v1.0` with no prefix is the backend only. Ignore it.)

```text
Internet --HTTPS--> your reverse proxy --> 127.0.0.1:8080 (frontend) --/api--> backend --> database
                                                                                      \--> objectstore
```

## 1. Server requirements

- Linux server, 2 vCPU / 4 GB RAM / 20 GB disk or more
- Docker Engine with the Compose v2 plugin: `docker compose version` must work
- Outbound internet to Docker Hub and Google (`googleapis.com`)
- A DNS name pointing at the server, e.g. `accord360.jhubafrica.com`
- Ports 80/443 open for the reverse proxy. Nothing else needs to be public.

## 2. Get the deployment files onto the server

You only need one folder, `backend/accord360-deployment/`, containing `install.sh`, `docker-compose.yml`, `.env.example`. No source code is needed. Either:

```bash
# A) from the repository
git clone --depth 1 --filter=blob:none --sparse https://github.com/JHUB-AFRICA/accord360.git
cd accord360 && git sparse-checkout set backend/accord360-deployment
cd backend/accord360-deployment

# B) or copy the folder you were given
scp -r accord360-deployment/ user@server:~/ && ssh user@server && cd ~/accord360-deployment
```

## 3. You will be given these values

| Value | What it is |
|---|---|
| Google service-account key file (`.json`) | Lets the app create and share Google Docs. Keep it secret. |
| Google Shared Drive folder ID | Where drafting copies are created |
| Public URL | e.g. `https://accord360.jhubafrica.com` |
| Release tag | e.g. `sha-5d01aea7905c5f4be91bc30fd33dcb87cb7d3708` (or `v1.0`) |

Put the key file on the server somewhere only you can read (`chmod 600`).

## 4. Install (one command)

```bash
ACCORD360_RELEASE_TAG=sha-5d01aea7905c5f4be91bc30fd33dcb87cb7d3708 \
ACCORD360_PUBLIC_URL=https://accord360.jhubafrica.com \
ACCORD360_GOOGLE_KEY_FILE=/path/to/service-account.json \
ACCORD360_GOOGLE_FOLDER_ID=<shared-drive-folder-id> \
./install.sh
```

What it does, so nothing is a surprise:

1. Creates `.env` (mode 600) with freshly generated database, storage and app secrets.
2. Pulls the four images from Docker Hub.
3. Starts them in order: database and object storage, then backend (runs database migrations and creates the storage bucket), then frontend.
4. Waits until all four report **healthy**, then prints the status table.

It is safe to re-run. An existing `.env` is never overwritten, and data lives in named Docker volumes.

If the Docker Hub repository ever becomes private, run `docker login` first.

### Optional inputs

| Variable | Use |
|---|---|
| `ACCORD360_DEMO_SIGNUP=false` | Disables the demo flow that lets anyone with the link create an account with just an email + office. Enabled by default for this demo deployment. |
| `ACCORD360_IMAGE_REPOSITORY` | Use a different image repository |
| `ACCORD360_SKIP_PULL=1` | Images were already loaded (see section 8) |

## 5. HTTPS reverse proxy

Point the public domain at **`http://127.0.0.1:8080`**. That is the **frontend**.

> **Do not point the domain at port 8000.** That is the raw backend API and only shows
> `{"name":"Accord 360","status":"running",...}` instead of the application.

Caddy (automatic HTTPS):

```caddy
accord360.jhubafrica.com {
    request_body {
        max_size 30MB
    }
    reverse_proxy 127.0.0.1:8080
}
```

Nginx (use certbot for the certificate):

```nginx
server {
    server_name accord360.jhubafrica.com;
    client_max_body_size 30m;            # signed agreements can be up to 25 MB
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Cloudflare Tunnel works too: set the service to `http://localhost:8080`.

`ACCORD360_PUBLIC_URL` must equal the exact URL users type in the browser, otherwise the browser blocks API calls.

## 6. Verify

```bash
docker compose ps                                  # all four: "healthy"
curl -s http://127.0.0.1:8080/api/auth/config      # returns {"demo_signup_enabled": ...}
curl -sI https://accord360.jhubafrica.com | head -1 # HTTP/2 200
docker compose logs accord-backend | grep -E "application_ready|object_storage_ready"
```

Expected log lines: `application_ready ... database=postgresql object_storage=True` and `object_storage_ready bucket=accord-360`.

Then open the public URL in a browser: you should see the Accord 360 login page.

## 7. Hand over to the application owner

The application starts empty by design (no demo data). To create the first Linkages account:

```bash
docker compose exec accord-backend python -m app.bootstrap \
  --email <linkages-person@their-domain> --name "Full Name" --role linkages
```

(It prompts for a password.) The application owner then signs in as Linkages and adds the document templates (Google Doc IDs) on the Templates page. The Google Docs must be shared with the service account (`client_email` in the key file) as Editor, and the service account should be a **Manager** of the Shared Drive.

## 8. No internet on the server, or a locked-down registry? Move images by file

On any machine with Docker Hub access:

```bash
TAG=sha-5d01aea7905c5f4be91bc30fd33dcb87cb7d3708
docker pull jhubafrica/accord360-app:backend-$TAG
docker pull jhubafrica/accord360-app:frontend-$TAG
docker pull postgres:16-alpine
docker pull rustfs/rustfs:1.0.6
docker save jhubafrica/accord360-app:backend-$TAG jhubafrica/accord360-app:frontend-$TAG \
            postgres:16-alpine rustfs/rustfs:1.0.6 | gzip > accord360-images.tar.gz
scp accord360-images.tar.gz user@server:~/
```

On the server:

```bash
gunzip -c accord360-images.tar.gz | docker load
ACCORD360_SKIP_PULL=1 ACCORD360_RELEASE_TAG=$TAG ... ./install.sh   # same variables as section 4
```

## 9. Updating to a new release

```bash
# 1. set RELEASE_TAG=<new tag> in .env  (or re-run install.sh with ACCORD360_RELEASE_TAG=<new tag>)
docker compose pull
docker compose up -d --wait
docker compose logs --tail=50 accord-backend
```

Database migrations run automatically on backend start. **Rollback:** set the previous `RELEASE_TAG` and run the same two commands.

## 10. Backups (set up a schedule)

```bash
set -a; . ./.env; set +a
mkdir -p backups
docker compose exec -T database pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  | gzip > "backups/accord360-$(date +%Y%m%d-%H%M%S).sql.gz"
docker run --rm -v "$(basename "$PWD")_accord360_objects:/data:ro" -v "$PWD/backups:/backup" alpine \
  tar czf "/backup/objects-$(date +%Y%m%d-%H%M%S).tgz" -C /data .
```

Copy backups off the server. Test a restore occasionally.

## 11. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Domain shows `{"name":"Accord 360","status":"running"...}` | Proxy points at 8000. Point it at **8080**. |
| Browser shows network/CORS errors | `CORS_ORIGINS` in `.env` ≠ the public URL. Fix, then `docker compose up -d`. |
| "Google Drive integration is disabled" when creating an agreement | Google settings missing. Check `GOOGLE_DRIVE_ENABLED=true` and that `GOOGLE_SERVICE_ACCOUNT_JSON` is the raw JSON (not a file path) in `.env`. Re-run `install.sh` with the key file. |
| Upload of a signed agreement fails with 413 | Your reverse proxy's body limit is below 30 MB (see section 5). |
| `accord-backend` restarts / unhealthy | `docker compose logs accord-backend`. A "SEED_DEMO_DATA must be false" or "SECRET_KEY" message means a bad `.env` value. |
| Start over completely | `docker compose down -v` **deletes the database, uploads and stored agreements.** Only when intended. |

Useful commands:

```bash
docker compose ps
docker compose logs -f accord-backend frontend
docker compose restart accord-backend
docker compose down            # stop, keep data
```

## 12. Security notes

- `.env` holds all secrets (and the Google key): mode 600, never commit it or send it over chat.
- Only the reverse proxy should be reachable from the internet. The app ports and the storage console (`127.0.0.1:9001`) are bound to localhost.
- Keep `SEED_DEMO_DATA=false`. This demo package enables `ALLOW_DEMO_SIGNUP=true` by default; set `ACCORD360_DEMO_SIGNUP=false` before exposing it as a real production system.
- Anyone who is a **member of the Google Shared Drive** can open every agreement document at every stage. Keep that membership short.
