# CI/CD pipeline (GitHub Actions)

This document describes the **CI/CD Pipeline** workflow (`.github/workflows/ci-cd.yml`): stages, jobs, tools, artifacts, and how to wire a real deployment.

## Triggers and concurrency

- **Triggers**: pushes and pull requests to `main` and `master`.
- **Concurrency**: one run per branch (`cancel-in-progress: true`) so newer commits supersede older pipeline runs.

## Stage overview

| Stage | GitHub Actions jobs | Purpose |
|--------|---------------------|---------|
| **1 · Build** | `build` | Install dependencies, compile backend, build frontend, publish build artifacts. |
| **2 · Security** | `security-bandit`, `security-trivy-fs`, `security-trivy-image`, `security-pip-audit` | SAST, dependency/supply-chain, filesystem and container image vulnerability scans. |
| **3 · Test** | `test-backend`, `test-frontend` | Automated tests and coverage for API and SPA. |
| **4 · DAST** | `dast-zap` | Run the API in CI and drive **OWASP ZAP** baseline against it. |
| **Quality** | `sonarcloud` | SonarCloud / SonarQube analysis (coverage-aware when reports are present). |
| **4 · Deploy (simulation)** | `deploy-simulation` | Safe placeholder that downloads build artifacts and simulates a release. |

Stages **2** (security) and **3** (test) start only after **build** succeeds; they run **in parallel** where possible to keep wall-clock time reasonable.

---

## Stage 1 — Build (`build`)

**Goals**

- Prove the backend dependency set resolves and byte-compiles.
- Prove the frontend installs cleanly and produces a production `dist/`.
- Capture immutable build metadata for audit and deploy simulation.

**Steps (summary)**

1. Checkout repository.
2. **Python 3.12**: upgrade `pip`, `pip install -r backend/requirements.txt`, `python -m compileall -q backend/app`.
3. **Node 22**: `npm ci` and `npm run build` in `frontend/`.

**Artifacts**

| Artifact | Contents |
|----------|-----------|
| `frontend-dist` | `frontend/dist/` — static assets as produced by Vite. |
| `build-metadata` | `build-metadata.txt` — commit SHA, ref, UTC timestamp. |

**Why this matters**

- Fails fast on broken imports, missing files, or TypeScript/build errors before security and test jobs spend time.

---

## Stage 2 — Security scans

All security jobs **depend on `build`** so the repository is known-good from a dependency-resolution perspective before deeper analysis.

### Bandit (`security-bandit`)

- **What it is**: Python **SAST** focused on security anti-patterns (e.g. unsafe use of `eval`, weak crypto, binding to all interfaces).
- **How we run it**: `bandit -r backend/app -ll -ii -x backend/tests -f sarif -o bandit-report.sarif`
  - `-ll` / `-ii`: report only medium+ confidence and medium+ severity.
  - `-x backend/tests`: exclude test code from rules that are noisy for tests.
- **Policy**: Findings **fail the job** after the SARIF report is uploaded (upload uses `continue-on-error` on the scan step so the artifact is still available when Bandit fails).
- **Artifact**: `security-bandit` — `bandit-report.sarif` (SARIF for dashboards or GitHub Advanced Security import, if you add a `codeql`/`upload-sarif` step later).

### Trivy — filesystem (`security-trivy-fs`)

- **What it is**: **Aqua Security Trivy** scans the repo for known **CVEs** in OS packages, language libraries, and misconfigurations (depending on detectors enabled).
- **How we run it**: `scan-type: fs`, `scan-ref: .`, severities **HIGH,CRITICAL**, `skip-dirs: frontend/node_modules,.git`.
- **Exit code**: `0` so the pipeline still collects **informational** filesystem results without failing purely on transitive frontend dev tooling noise; tune to `exit-code: "1"` when you want a hard gate.
- **Outputs**: SARIF + human-readable table.
- **Artifact**: `security-trivy-fs` — `trivy-fs.sarif`, `trivy-fs-table.txt`.

### Trivy — backend container image (`security-trivy-image`)

- **What it is**: Same Trivy engine, **image** mode: scans the layers of the Docker image built from `backend/Dockerfile`.
- **How we run it**: `docker/build-push-action` with `load: true` and tag `psc-backend:ci`, then `trivy-action` with `image-ref: psc-backend:ci`.
- **Why both fs and image**: Filesystem scan catches repo-level issues; image scan catches packages introduced only in the image build (base image drift, build-time installs).
- **Artifact**: `security-trivy-image` — `trivy-image.sarif`, `trivy-image-table.txt`.

### pip-audit (`security-pip-audit`)

- **What it is**: Audits **Python dependencies** declared in `backend/requirements.txt` against known vulnerability databases (PyPI advisory data via OSV, etc.).
- **How we run it**: JSON and human-readable text; steps allow non-zero exit so the job can still upload reports (policy can be tightened later).
- **Artifact**: `security-pip-audit` — `backend/pip-audit.json`, `backend/pip-audit.txt`.

### pytest-security (third-party plugin)

There is **no standard PyPI package** named `pytest-security` that replaces a full security program. This project instead uses:

- **`@pytest.mark.security`** on targeted tests (auth, RBAC, payloads, headers, etc.).
- The **full pytest suite** in CI (including those tests), with **JUnit** and **coverage** for Sonar.

To run only security-tagged tests locally:

```bash
cd backend && pytest -m security -q
```

---

## Stage 3 — Test

### Backend (`test-backend`)

- **Install**: Same as build — `pip install -r backend/requirements.txt`.
- **Run**: `pytest -q --junitxml=junit.xml` with project defaults from `backend/pytest.ini` (`--cov=app`, `coverage.xml`).
- **Artifact**: `test-backend-reports` — `backend/coverage.xml`, `backend/junit.xml`.

### Frontend (`test-frontend`)

- **Install**: `npm ci` in `frontend/`.
- **Run**: `npm run test:coverage` (Vitest + V8 coverage, LCOV + HTML).
- **Artifact**: `test-frontend-coverage` — full `frontend/coverage/` directory (includes `lcov.info` for Sonar).

---

## Stage 4 — DAST: OWASP ZAP (`dast-zap`)

**Goals**

- Run a **real** API process in CI and scan it with **OWASP ZAP Baseline** (passive / low-impact checks suitable for automation).

**Flow**

1. Install backend dependencies.
2. Start `python run.py` with CI-only secrets and:
   - `DATABASE_URI=sqlite:////tmp/psc_ci.sqlite`
   - `AUTO_DB_CREATE_ALL=1` so tables exist without a manual migration step in this demo pipeline.
   - `VAULT_KDF_PEPPER` set to a 32+ character test value (required by the app for vault crypto).
3. Wait until `GET /api/v1/health` returns HTTP 200 (rate-limit exempt health route).
4. Run `zap-baseline.py` in Docker with **host networking** so the container can reach `127.0.0.1:5000`.
5. Write **HTML, JSON, and Markdown** reports under `zap-reports/`.

**Job policy**

- `continue-on-error: true` on the **job**: baseline scans often surface low-risk noise on APIs without full OpenAPI tuning. Reports are always uploaded; tighten policy by removing `continue-on-error` or fixing ZAP config when ready.

**Artifact**

- `dast-zap-reports` — includes `zap-report.html`, `zap-report.json`, `zap-report.md`, and `api.log`.

---

## Quality — SonarCloud / SonarQube (`sonarcloud`)

- **Scanner**: `SonarSource/sonarqube-scan-action@v5.0.0`.
- **Configuration**: `sonar-project.properties` at repo root (set `sonar.organization` and `sonar.projectKey`; add **`SONAR_TOKEN`** in GitHub repository secrets).
- **Coverage wiring** (after CI downloads artifacts):
  - `sonar.python.coverageReportPaths=backend/coverage.xml`
  - `sonar.javascript.lcov.reportPaths=frontend/coverage/lcov.info`

**Job policy**

- `continue-on-error: true` so missing/invalid `SONAR_TOKEN` or Sonar misconfiguration does not block merge while you are onboarding Sonar.

---

## Stage 4 — Deploy simulation (`deploy-simulation`)

**Goals**

- Prove **artifacts chain** from build → downloadable bundle.
- Document what a **real** deploy would do without touching production credentials.

**Steps**

1. Download `frontend-dist` and `build-metadata` into `deploy-sim/`.
2. Print a scripted narrative (container registry push, orchestration update, smoke tests).
3. Upload `deploy-simulation-bundle` containing the simulated deploy directory.

**Replacing with a real deploy**

- Authenticate to your cloud (`aws`, `gcloud`, `az`, `kubectl`, GitHub `registry`).
- Push images built from `backend/Dockerfile` and `frontend/Dockerfile` (or publish `frontend/dist` to static hosting).
- Apply Helm manifests or run your PaaS CLI, then hit health checks.

Use **GitHub Environments** with **required reviewers** and **branch protection** before enabling live deploys from `main`.

---

## Artifact reference

| Artifact name | Produced by | Typical use |
|----------------|-------------|-------------|
| `frontend-dist` | Build | Static hosting or embed in container image. |
| `build-metadata` | Build | Traceability (SHA, ref, time). |
| `security-bandit` | Bandit | SARIF dashboards, security review. |
| `security-trivy-fs` | Trivy fs | SARIS/table vulnerability review. |
| `security-trivy-image` | Trivy image | Image CVE review before registry push. |
| `security-pip-audit` | pip-audit | Dependency CVE audit. |
| `test-backend-reports` | pytest | Sonar coverage, CI test tab (JUnit). |
| `test-frontend-coverage` | Vitest | Sonar JS/TS coverage, HTML report. |
| `dast-zap-reports` | ZAP | DAST triage, audit evidence. |
| `deploy-simulation-bundle` | Deploy simulation | Example of packaged “release” output. |

Download artifacts from the **Actions** run summary in GitHub.

---

## Secrets checklist

| Secret | Required for |
|--------|----------------|
| `SONAR_TOKEN` | SonarCloud (or SonarQube token if you point the scanner at a self-hosted server). |
| (Future) Registry / cloud tokens | Real deploy job — never commit these; use GitHub **OIDC** or encrypted secrets. |

`GITHUB_TOKEN` is injected automatically for the Sonar action.

---

## Local parity (optional)

```bash
# Backend
cd backend && pip install -r requirements.txt && pytest -q --junitxml=junit.xml

# Frontend
cd frontend && npm ci && npm run test:coverage && npm run build

# Bandit (from repo root)
pip install 'bandit[toml]==1.7.10'
bandit -r backend/app -ll -ii -x backend/tests -f sarif -o bandit-report.sarif
```

Trivy and ZAP are easiest to reproduce via the same Docker images the workflow uses.

---

## Maintenance tips

- **Bump actions** periodically (`actions/checkout`, `aquasecurity/trivy-action`, `SonarSource/sonarqube-scan-action`, etc.) for security patches.
- **Tune ZAP** with `-c` config or a custom rules file when the API stabilizes, then consider failing the job on new high findings.
- **Tighten Trivy** `exit-code` when the dependency tree is clean enough that CI noise is low.
