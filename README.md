# Password Strength Checker & Manager

Full-stack password security evaluation and credential management demo built for coursework-style assessments: **Flask + SQLAlchemy + MySQL**, **React + Vite + Tailwind CSS v4 + Framer Motion**, **JWT authentication**, **RBAC**, **TOTP 2FA (PyOTP / Google Authenticator)**, **bcrypt + Argon2id hashing demos**, **HIBP range API**, optional **local breach file** scanning, and a **GitHub Actions** pipeline (**build → SAST/SCA/container scan → tests → DAST → optional Sonar → deploy placeholder**).

## Features

| Area | Details |
|------|---------|
| Analysis | Shannon-style entropy upper bound, complexity score, common-password dictionary, keyboard/sequence patterns, suggestions, crack-time simulation |
| Exposure | Have I Been Pwned k-anonymity (SHA-1 prefix only on the wire) + optional local hash file compatible with [Pwned Passwords downloader](https://github.com/HaveIBeenPwned/PwnedPasswordsDownloader) |
| Vault | Encrypted at rest with per-user Fernet keys derived via HKDF (see threat model below) |
| AuthN/Z | **Argon2id** password hashes (legacy bcrypt verify), JWT access/refresh, roles `admin` / `user`, admin-only directory API, Flask-Limiter on auth |
| 2FA | TOTP enrollment (QR + secret once), login gate with short-lived `twofa_pending` JWT |
| CI security | **Bandit**, **Trivy**, **pip-audit**, **OWASP ZAP baseline**, optional **SonarCloud** (see `sonar-project.properties`) |
| Tests | `pytest` with `@pytest.mark.security` for auth, RBAC, 2FA, and security headers |

> **Note on “pytest-security”:** There is no widely adopted PyPI package by that exact name for our stack. This repo implements the same intent with a **dedicated `@pytest.mark.security` suite** plus **pip-audit** in CI for dependency posture (see `docs/SECURITY_FINDINGS.md`).

## Quick start (local dev)

### 1. MySQL (Workbench-compatible)

Create a database and user (example):

```sql
CREATE DATABASE password_security CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'psc_user'@'%' IDENTIFIED BY 'psc_pass';
GRANT ALL PRIVILEGES ON password_security.* TO 'psc_user'@'%';
FLUSH PRIVILEGES;
```

Copy `backend/.env.example` → `backend/.env` and set `DATABASE_URI`, `SECRET_KEY`, `JWT_SECRET_KEY`, `VAULT_KDF_PEPPER` (each **≥ 32 characters**), and optional `LOCAL_BREACH_FILE` (path to a SHA-1-per-line file from the official downloader).

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # then edit values
export FLASK_APP=run:app
flask db upgrade        # apply Alembic migrations (MySQL or SQLite)
python run.py
```

JSON API is versioned under **`/api/v1`** (see `API_PREFIX` in `.env`). Health: `GET /api/v1/health`.

API listens on `http://127.0.0.1:5000` by default.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite dev server proxies `/api` to `http://127.0.0.1:5000` (see `frontend/vite.config.ts`). The SPA client defaults to `VITE_API_PREFIX=/api/v1` (see `frontend/src/lib/api.ts`). For production builds behind another host, set `VITE_API_URL` to your API origin.

### 4. Docker (MySQL + API + nginx)

See **[`docs/DOCKER.md`](docs/DOCKER.md)** for `.env` setup, Workbench, migrations (including automatic migrate on API start), bootstrap admin seeding, tests, and security scans.

```bash
cp .env.example .env   # edit every CHANGE_ME_* value
docker compose up --build
```

- SPA (via nginx): `http://localhost:8080` · API: `http://localhost:5000` · MySQL: `localhost:${MYSQL_PORT:-3306}`

## Threat model highlights (read before storing real secrets)

1. **Vault encryption** uses an HKDF-derived per-user key from `VAULT_KDF_PEPPER` and the user id. Anyone with **database + pepper** can decrypt vault rows. This is acceptable for a **graded demo**; production should use a user-held master password, KMS/HSM, or client-side encryption.
2. **2FA pending JWT** is short-lived (5 minutes) and blocked from privileged routes until OTP succeeds (`jwt_full` in `backend/app/security/rbac.py`).
3. **HIBP** never ships full password hashes to the range service—only the first 5 hex chars of the SHA-1 digest (k-anonymity contract).

## Testing & security tooling locally

```bash
cd backend
pytest -q
bandit -r app -ll -ii -x tests
pip-audit -r requirements.txt
```

## CI/CD

Workflow: [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml)

Full stage and tool reference: [`docs/CI_CD_PIPELINE.md`](docs/CI_CD_PIPELINE.md)

Summary:

1. **Build** — backend install + `compileall`, frontend `npm ci` + production build; artifacts (`frontend-dist`, `build-metadata`).  
2. **Security** — **Bandit** (SARIF, failing), **Trivy** filesystem + **backend Docker image**, **pip-audit** (reports).  
3. **Test** — **pytest** + coverage + JUnit; **Vitest** + coverage (LCOV for Sonar).  
4. **DAST** — start API in CI, **OWASP ZAP** baseline (HTML/JSON/MD reports; job `continue-on-error: true` until tuned).  
5. **SonarCloud** — optional until `SONAR_TOKEN` and `sonar-project.properties` are set; downloads coverage artifacts.  
6. **Deploy simulation** — downloads build artifacts and prints a safe release checklist (replace with real deploy when ready).

## Assessment readiness checklist

| Requirement | Automated | Manual (when DB is up) |
|-------------|-----------|-------------------------|
| Flask API + migrations | `cd backend && pytest -q` (includes auth, RBAC, 2FA, vault, password analysis, audit) | `flask db upgrade`, `GET /api/v1/health` |
| React SPA | `cd frontend && npm run test -- --run` and `npm run build` | `npm run dev` — tabs: Analyzer, Generator, HIBP, Vault, Hashing, 2FA, Admin (admin role) |
| MySQL + Workbench | — | Create DB/user per [Quick start](#1-mysql-workbench-compatible); point `DATABASE_URI` at host/port; connect Workbench to same host |
| Docker stack | CI workflow validates YAML + build stages | `docker compose up --build` per [`docs/DOCKER.md`](docs/DOCKER.md) |
| Security scans in CI | [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) — Bandit, Trivy, pip-audit, ZAP (non-blocking until tuned) | Same tools locally (see [Testing & security tooling locally](#testing--security-tooling-locally)) |
| Documentation + remediation evidence | — | [`docs/PROFESSIONAL_ASSESSMENT.md`](docs/PROFESSIONAL_ASSESSMENT.md), [`docs/SECURITY_FINDINGS.md`](docs/SECURITY_FINDINGS.md), [`docs/VULNERABILITY_REMEDIATION.md`](docs/VULNERABILITY_REMEDIATION.md) |

## Documentation

- [**Professional Assessment (full narrative)**](docs/PROFESSIONAL_ASSESSMENT.md) — overview, architecture, password security, threat model, controls, DevSecOps, testing, deployment summary, user manual, roadmap  
- [**Assessment index**](docs/ASSESSMENT_INDEX.md) — links to all assessment-related docs  
- [`docs/API.md`](docs/API.md) — HTTP API reference  
- [`docs/DOCKER.md`](docs/DOCKER.md) — Docker Compose, MySQL Workbench, migrations, seeding, tests, security scans  
- [`docs/CI_CD_PIPELINE.md`](docs/CI_CD_PIPELINE.md) — GitHub Actions stages, security tools, artifacts, deploy simulation  
- [`docs/SECURITY_FINDINGS.md`](docs/SECURITY_FINDINGS.md) — tool findings & residual risks  
- [`docs/VULNERABILITY_REMEDIATION.md`](docs/VULNERABILITY_REMEDIATION.md) — evidence of fixes and version bumps  
- [`scripts/hibp_local_breach.md`](scripts/hibp_local_breach.md) — offline breach corpora

## License

MIT (adjust for your institution’s policy).
