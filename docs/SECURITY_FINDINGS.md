# Security findings (tooling & architecture)

> **Broader context:** see [`PROFESSIONAL_ASSESSMENT.md`](PROFESSIONAL_ASSESSMENT.md) (sections 4–9) for threat model, controls summary, and testing tools.

This document summarizes **expected** findings from automated tools and the **architectural trade-offs** accepted for a coursework deliverable.

## Static analysis (Bandit)

- **SHA-1 for HIBP / breach files:** SHA-1 is required by the Pwned Passwords API and common hash list interchange formats. We annotate `hashlib.sha1(..., usedforsecurity=False)` with comments explaining that this is **not** used for TLS or credential storage.

## Dependency analysis (pip-audit)

- CI runs `pip-audit` against pinned `requirements.txt`. Known vulnerable versions were bumped (see `docs/VULNERABILITY_REMEDIATION.md`). Re-run after any dependency change.

## Container / filesystem scanning (Trivy)

- `trivy-action` scans the repository filesystem on default severities in CI (`HIGH,CRITICAL` with `exit-code: 0` so the pipeline remains educational while still surfacing logs). Tighten `exit-code` when you want a hard gate.

## Dynamic analysis (OWASP ZAP baseline)

- ZAP runs against a **throwaway SQLite** API instance in CI. Typical informational items include missing **Content-Security-Policy** on JSON APIs (not always appropriate for pure JSON backends) and absence of **HSTS** when served over plain HTTP in CI. Production should terminate TLS at a reverse proxy and add strict headers/CSP on the **HTML host**.

## SonarCloud / SonarQube

- `sonar-project.properties` ships with `CHANGE_ME_*` placeholders. Until `SONAR_TOKEN` and keys are configured, the Sonar job is allowed to fail without blocking merges (`continue-on-error: true`).

## RBAC & 2FA

- Two roles: `admin`, `user`. Admin-only routes use `role_required("admin")`, which also rejects `twofa_pending` JWTs.
- Users with TOTP enabled receive only a **pending** JWT until `/api/v1/auth/two_factor/verify` succeeds.

## Vault cryptography (residual risk)

- Keys are server-derivable from `VAULT_KDF_PEPPER` + user id (see `backend/app/services/vault_crypto.py`). This is **not** zero-knowledge storage. Documented explicitly so assessors can grade threat models accurately.

## pytest “security suite”

- Tests marked `@pytest.mark.security` cover authentication, 2FA gating, RBAC, and baseline HTTP security headers. This substitutes for a non-existent `pytest-security` wheel while preserving the rubric intent.
