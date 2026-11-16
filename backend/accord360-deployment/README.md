# Accord 360 deployment

This package runs the complete Accord 360 application on the owner's server:

- `frontend` serves the React application and proxies `/api` to the backend.
- `backend` runs FastAPI and connects to PostgreSQL.
- `database` runs PostgreSQL with persistent storage.

The application source code is not required on the server. Docker Compose pulls
matching frontend and backend images from Docker Hub and connects all three
services on its private default network.

## Release images

Merges to `main` run the GitHub Actions workflow in
`.github/workflows/backend-ci-cd.yml`. After the backend tests and frontend
verification gate pass, the workflow publishes:

```text
<dockerhub-user>/accord360-backend:sha-<full-git-commit>
<dockerhub-user>/accord360-frontend:sha-<full-git-commit>
```

It also updates the `latest` tag for both images. Deploy the immutable `sha-...`
tag rather than `latest` so the frontend and backend always come from the same
commit and a rollback remains predictable.

The GitHub repository must define these Actions secrets:

```text
DOCKERHUB_USERNAME
DOCKERHUB_TOKEN
```

Create `accord360-backend` and `accord360-frontend` under that Docker Hub user
or organization first. Use a Docker Hub access token with read/write permission
for both repositories. The token must not be committed to this deployment
package.

## Requirements

- Linux server with Docker Engine and the Docker Compose plugin
- A DNS name pointing to the server
- HTTPS termination through Nginx, Caddy, Traefik, or an equivalent proxy
- Access to Docker Hub, including `docker login` when the images are private

## Service connections

Docker Compose provides internal DNS based on service names:

```text
browser -> HTTPS reverse proxy -> frontend:80
frontend /api -> backend:8000
backend -> database:5432
```

PostgreSQL is not published on a host port. The frontend and backend are bound
to localhost so they can be reached by the host reverse proxy and diagnostics,
but not directly over the server's public network interface.

## First installation

Copy this directory to a stable location on the server, then create its private
configuration:

```bash
cp .env.example .env
```

Edit `.env` and replace every placeholder. Set `DOCKERHUB_USERNAME` and set
`RELEASE_TAG` to the `sha-...` tag shown by the successful GitHub Actions run.
Also configure a strong `SECRET_KEY`, database password, public HTTPS origin,
and object-storage credentials when object storage is enabled.

If the Docker Hub repositories are private, authenticate once on the server:

```bash
docker login
```

Pull and start the release:

```bash
docker compose pull
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:8000/health
curl --fail http://127.0.0.1:8080/
```

The backend applies Alembic database migrations before serving traffic. The
database and local uploads survive container replacement through named Docker
volumes.

Configure the host reverse proxy to send public HTTPS traffic to
`http://127.0.0.1:8080`. The frontend container serves the SPA and forwards its
`/api` traffic to the backend over the private Compose network.

## Updating

After the GitHub Actions run for a merge to `main` succeeds, change
`RELEASE_TAG` in the server's `.env` to the new `sha-...` tag and run:

```bash
docker compose pull frontend backend
docker compose up -d --remove-orphans
docker compose ps
docker compose logs --tail=100 backend frontend
```

The server now pulls both images from exactly the same Git commit. For a
rollback, restore the previous `RELEASE_TAG` and run the same commands.

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
Copy backups off the application server and periodically test a restore in a
separate environment.

## Operations

```bash
docker compose logs -f backend frontend
docker compose restart backend frontend
docker compose down       # stops containers; keeps volumes
```

Do not use `docker compose down -v` unless intentionally deleting the database
and uploaded documents. Keep `SEED_DEMO_DATA=false` for production deployments.
