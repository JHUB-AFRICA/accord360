# Accord 360 deployment

This package runs the Accord 360 backend and PostgreSQL on the owner's server.
The backend image is pulled from the container registry; application source
code is not required on the server.

## Requirements

- Linux server with Docker Engine and the Docker Compose plugin
- A DNS name pointing to the server
- HTTPS termination through Nginx, Caddy, Traefik, or an equivalent proxy
- Access to the registry containing the Accord 360 image

## Publishing a release

From the backend repository root, build and push a versioned image. Replace
the registry path with the registry used by the project:

```bash
docker build -t ghcr.io/your-organization/accord360-backend:1.0.0 .
docker push ghcr.io/your-organization/accord360-backend:1.0.0
```

Set the same image reference in the owner's `.env` file. Do not put registry
passwords, application secrets, or object-storage credentials in this package.

## First installation

```bash
cp .env.example .env
```

Edit `.env` and replace all placeholders. In particular, configure the image,
`SECRET_KEY`, database password, CORS origin, and registry credentials if the
image is private. Then start the services:

```bash
docker login ghcr.io
docker compose pull
docker compose up -d
docker compose ps
curl http://127.0.0.1:8000/health
```

The backend applies database migrations before serving traffic. The database
and local uploads survive container recreation through named Docker volumes.

## Updating

Change `ACCORD360_IMAGE` to the new version in `.env`, then run:

```bash
docker compose pull backend
docker compose up -d backend
docker compose logs --tail=100 backend
```

Keep versioned image tags so a rollback is possible by changing the image tag
back to the previous release.

## Backups

Create a database backup from this directory:

```bash
mkdir -p backups
docker compose exec -T database pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  | gzip > "backups/accord360-$(date +%Y%m%d-%H%M%S).sql.gz"
```

The command expects the variables from `.env` to be available in the shell:

```bash
set -a
. ./.env
set +a
```

If local uploads are enabled, back up the `accord360_uploads` volume as well,
or use S3-compatible object storage and apply its retention/versioning policy.
Backups should be copied off the server and periodically tested by restoring
to a separate environment.

## Operations

```bash
docker compose logs -f backend
docker compose restart backend
docker compose down       # stops containers; keeps volumes
```

Do not use `docker compose down -v` unless intentionally deleting the database
and uploaded documents. The frontend, if deployed separately, should call the
backend through the HTTPS domain configured in `CORS_ORIGINS`.
