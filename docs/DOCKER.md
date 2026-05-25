# Docker & MySQL deployment guide

This project ships **Dockerfiles** for the Flask API and the Vite/React SPA, a **Docker Compose** stack with **MySQL 8.0** (compatible with **MySQL Workbench** over standard TCP/IP), and **`.env.example`** templates. There are **no committed secrets**: copy examples to `.env`, generate strong values, and keep `.env` out of version control.

Related: [CI/CD pipeline](CI_CD_PIPELINE.md) · [API reference](API.md)

---

## What gets built

| Component | File | Runtime user | Notes |
|-----------|------|----------------|--------|
| API | `backend/Dockerfile` | `appuser` (UID 1000) | Gunicorn, `requirements-prod.txt`, Alembic migrations on start. |
| SPA | `frontend/Dockerfile` | `nginx` (official **unprivileged** image) | Static files + nginx reverse proxy to the API. |
| Database | `mysql:8.0` | MySQL entrypoint (root in container only) | UTF-8 **utf8mb4**; port **3306** published to the host by default. |
| Orchestration | `docker-compose.yml` | — | Healthchecks, `depends_on` conditions, env interpolation from `.env`. |

---

## Local setup (without Docker)

1. **Python 3.12** and **Node 22** on your machine.  
2. **MySQL 8** locally (or remote) — create database and user matching `DATABASE_URI`.  
3. Copy **`backend/.env.example`** → `backend/.env` and set secrets (≥32 chars for `SECRET_KEY`, `JWT_SECRET_KEY`, `VAULT_KDF_PEPPER`).  
4. Backend: `cd backend && pip install -r requirements.txt && flask db upgrade && python run.py`  
5. Frontend: `cd frontend && npm ci && npm run dev` (Vite proxies `/api` to `http://127.0.0.1:5000`).

---

## Docker setup

### 1. Create environment files

From the **repository root**:

```bash
cp .env.example .env
```

Edit `.env` and replace every `CHANGE_ME_*` placeholder. Rules:

- **`MYSQL_PASSWORD`** must match the password embedded in **`DATABASE_URI`** (URL-encode reserved characters such as `@`, `#`, `%` in the URI).  
- **`SECRET_KEY`**, **`JWT_SECRET_KEY`**, **`VAULT_KDF_PEPPER`**: at least **32 characters** each (enforced at API startup).  
- **`CORS_ORIGINS`**: include the browser origin for the SPA (default stack: `http://localhost:8080`).  
- **`FLASK_ENV=production`** is set in Compose for the API so **`ProductionConfig`** is used (stricter checks; see `backend/app/config.py`).

Optional: for local **Vite** overrides only, copy `frontend/.env.example` → `frontend/.env` (not used by the production image build when build args are passed from Compose).

### 2. Start the stack

```bash
docker compose up --build
```

- **SPA + API through nginx**: `http://localhost:8080` (or `${WEB_PORT}`).  
- **API directly** (bypass nginx): `http://localhost:5000` (or `${API_PORT}`).  
- **Health**: `GET http://localhost:5000/api/v1/health` → `{"status":"ok",...}`.

### 3. How the API container starts

`backend/docker-entrypoint.sh`:

1. Waits until **MySQL TCP** is open (`DB_HOST` / `DB_PORT`, default `db:3306`).  
2. Runs **`flask db upgrade`** (retries on transient errors).  
3. **`exec gunicorn`** as non-root **`appuser`**.

Override behavior with env vars:

| Variable | Purpose |
|----------|---------|
| `SKIP_MIGRATIONS=1` | Skip `flask db upgrade` (debug only). |
| `GUNICORN_WORKERS`, `GUNICORN_THREADS`, `GUNICORN_TIMEOUT`, `GUNICORN_PORT` | Tune the server process model. |
| `DB_WAIT_SECONDS` | Max seconds to wait for MySQL before failing. |

### 4. Production-oriented settings

- **Secrets**: only from environment / `.env` — never hardcoded in Compose for real deploys (the committed `.env.example` uses obvious placeholders only).  
- **`FLASK_ENV=production`**: selects **`ProductionConfig`**; `validate_runtime_config` rejects **`LOG_REQUEST_BODY`** in production and requires **non-empty `CORS_ORIGINS`**.  
- **Rate limiting**: default `memory://` is fine for a single Gunicorn worker; for **multiple workers** use **Redis** (`RATELIMIT_STORAGE_URI=redis://...`) so limits are shared.  
- **TLS**: terminate HTTPS at a reverse proxy or load balancer in real production; containers listen on HTTP inside the private network.

---

## MySQL Workbench connection

1. Start Compose so **MySQL** is healthy (`docker compose ps`).  
2. In Workbench: **New Connection** → **Standard (TCP/IP)**.  
3. **Hostname**: `127.0.0.1` (or your Docker host).  
4. **Port**: value of **`MYSQL_PORT`** in `.env` (default **3306**).  
5. **Username**: `psc_user` (or `root` for administration — use a strong **`MYSQL_ROOT_PASSWORD`**).  
6. **Password**: matching **`MYSQL_PASSWORD`** / **`MYSQL_ROOT_PASSWORD`**.  
7. **Default schema**: `password_security` (or your **`MYSQL_DATABASE`**).

MySQL **8.0** uses **`caching_sha2_password`** by default; current Workbench versions support it. If you ever force `mysql_native_password`, set that in a custom `command:` on the `db` service (not required for typical Workbench 8+ clients).

---

## Running migrations

**Automatic (recommended in Docker):** every API container start runs `flask db upgrade` after MySQL is reachable.

**Manual (one-off):**

```bash
docker compose exec api flask db upgrade
```

**From host** (same `DATABASE_URI` as in `.env`, host `127.0.0.1` and published port):

```bash
cd backend
export FLASK_APP=run:app
export DATABASE_URI="mysql+pymysql://psc_user:YOURPASS@127.0.0.1:3306/password_security"
pip install -r requirements.txt
flask db upgrade
```

---

## Seeding data

There is **no separate SQL seed file** in-repo. The API **bootstraps one admin user** when the `users` table exists and is **empty**, using:

- `BOOTSTRAP_ADMIN_USERNAME`  
- `BOOTSTRAP_ADMIN_EMAIL`  
- `BOOTSTRAP_ADMIN_PASSWORD`  

Set these in `.env` before the first successful start after migrations. To **re-seed**, you must clear the `users` table (or wipe the volume) — destructive; do only in dev.

---

## Running tests

**Host** (recommended for developers):

```bash
cd backend && pytest -q
cd frontend && npm ci && npm run test:coverage
```

**Inside API container** (requires dev dependencies not installed in production image):

The production image only includes `requirements-prod.txt`. For containerized tests, either:

- Run tests on the CI runner / host as in [CI_CD_PIPELINE.md](CI_CD_PIPELINE.md), or  
- Build a **dev Dockerfile** that uses `requirements.txt` and mount the repo (not shipped by default).

---

## Running security scans

From the repo root (see also [CI_CD_PIPELINE.md](CI_CD_PIPELINE.md)):

```bash
# Bandit (Python SAST)
pip install 'bandit[toml]==1.7.10'
bandit -r backend/app -ll -ii -x backend/tests

# pip-audit (Python dependencies)
cd backend && pip-audit -r requirements.txt

# Trivy (filesystem)
docker run --rm -v "$PWD:/repo" aquasec/trivy:latest fs --severity HIGH,CRITICAL /repo

# Trivy (backend image)
docker build -t psc-backend:local ./backend
docker run --rm aquasec/trivy:latest image --severity HIGH,CRITICAL psc-backend:local
```

OWASP ZAP baseline against a running stack is described in the CI document.

---

## Operations cheatsheet

| Task | Command |
|------|---------|
| Logs (follow) | `docker compose logs -f api` |
| Restart API | `docker compose restart api` |
| Shell in API | `docker compose exec api /bin/sh` |
| MySQL shell | `docker compose exec db mysql -u psc_user -p"${MYSQL_PASSWORD}" password_security` |
| Wipe DB volume | `docker compose down -v` (**deletes all DB data**) |

---

## Troubleshooting

- **API exits on “SECRET_KEY must be set…”** — ensure all secrets in `.env` meet length rules and that Compose loads `.env` from the **same directory** as `docker-compose.yml`.  
- **Migrations fail “Table doesn’t exist”** — confirm `DATABASE_URI` points at **`db:3306`** inside Compose, not `127.0.0.1` (host-only).  
- **CORS errors in browser** — add your exact SPA origin (scheme + host + port) to **`CORS_ORIGINS`**.  
- **502 from nginx to API** — `docker compose ps` and `docker compose logs api`; confirm API health endpoint responds on port 5000 inside the network.
