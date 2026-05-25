# HTTP API Reference

Versioned base path: **`/api/v1`** (override with `API_PREFIX` in the backend environment).

Base URL: `http://127.0.0.1:5000` (development) or your deployment origin.  
JSON bodies use `Content-Type: application/json`. Authenticated routes expect `Authorization: Bearer <access_token>` unless noted.

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | No | Liveness JSON (`status`, `api_version`). Rate-limit exempt. |
| GET | `/api/v1/health/ready` | No | DB `SELECT 1` probe; `503` if database unreachable. |

## Authentication (`/api/v1/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | No | Create `user` role account; JSON validated/sanitized (see `app.utils.validation`). |
| POST | `/api/v1/auth/login` | No | `{ "username" \| "email", "password" }`. Returns tokens or `{ "two_factor_required": true, "pending_token" }`. Rate limited. |
| POST | `/api/v1/auth/two_factor/verify` | Pending JWT | Header: `Authorization: Bearer <pending_token>`, body `{ "code": "123456" }` → full session tokens. |
| POST | `/api/v1/auth/refresh` | Refresh JWT | `Authorization: Bearer <refresh>` (refresh type) → new `access_token`. |
| POST | `/api/v1/auth/two_factor/setup` | Access | Issues TOTP secret + `otpauth_url` + `qr_data_url` (PNG data URL). |
| POST | `/api/v1/auth/two_factor/enable` | Access | `{ "code" }` confirms enrollment → `totp_enabled=true`. |
| POST | `/api/v1/auth/two_factor/disable` | Access | `{ "password", "code" }` clears TOTP. |

## Password tools (`/api/v1`)

| Method | Path | Auth | Body | Description |
|--------|------|------|------|---------------|
| POST | `/api/v1/analyze` | Access (USER/ADMIN) | `{ "password" }` | Entropy, score, patterns, suggestions, crack estimate, HIBP/local breach metadata. |
| POST | `/api/v1/generate` | Access (USER/ADMIN) | See below | CSPRNG generation + strength analysis; **does not store** secrets. |

**`POST /api/v1/generate` body (JSON)**

| Field | Type | Default | Notes |
|-------|------|---------|--------|
| `mode` | string | `random` | `random` or `passphrase`. |
| `count` | int | `1` | 1–10 independent options; each includes `analysis`, `crack_estimate`, `constraint_suggestions`. |
| `length` | int | `20` | Random mode; 8–128. |
| `use_upper`, `use_lower`, `use_digits`, `use_symbols` | bool | `true` | Random mode; at least one class required. |
| `avoid_ambiguous` | bool | `false` | Random mode; drops `l`/`o`, `O`/`I`, `0`/`1`, `\|` from pools. |
| `word_count` | int | `6` | Passphrase mode; 2–16 words from `app/data/passphrase_words.txt`. |
| `separator` | string | `-` | Passphrase; printable ASCII, max 8 chars. |
| `capitalize_words` | bool | `false` | Passphrase Title Case per word. |

Response: `mode`, `count`, `options[]`. If `count === 1`, also top-level `password`, `analysis`, `crack_estimate`, `constraint_suggestions` for backward compatibility. Audit logs **never** contain generated passwords.

| Method | Path | Auth | Body | Description |
|--------|------|------|------|---------------|
| POST | `/api/v1/hibp` | Access (USER/ADMIN) | `{ "password" }` | HIBP **k-anonymity** range API: `found`, `breach_count`, legacy `pwned_count` (`-1` if unknown), `source` (`hibp` \| `local_fallback` \| `none`), `hibp_ok`, `hibp_error`, `local_checked`, `local_found`. Plaintext never sent to HIBP. See **`docs/HIBP_BREACH_CHECKING.md`**. |
| POST | `/api/v1/local-breach` | Access (USER/ADMIN) | `{ "password" }` | Scans `LOCAL_BREACH_FILE` (SHA-1 `HASH` or `HASH:count` per line); returns `breach_count` when matched. |
| POST | `/api/v1/hash-demo` | Access (USER/ADMIN) | `{ "password" }` | bcrypt + Argon2id hashes, per-algorithm wall time in ms, extracted parameters (`bcrypt_metadata`, `argon2_metadata`), and structured `education` text (salt, work factor, one-way property, why plaintext storage is unsafe, comparison). Plaintext is not stored; hash strings are not persisted — audit records algorithms and timings only. |
| POST | `/api/v1/crack-estimate` | Access (USER/ADMIN) | `{ "entropy_bits", "guesses_per_second?" }` | Hashcat-style upper-bound simulation. |

## Vault (`/api/v1/vault`)

Requires **access** (USER or ADMIN) with a full session (same as other protected routes).

Sensitive fields are stored encrypted (Fernet). List and single-item responses include decrypted **username** and **notes**, but **`password` is `null`** and **`password_hidden` is `true`** until the client calls **`POST .../reveal-password`**. All routes scope rows by the authenticated user (no IDOR).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/vault/items` | Access | List credentials; passwords masked. Audited as `vault_list`. |
| GET | `/api/v1/vault/items/search?q=` | Access | Search by title, `website_url`, or decrypted username substring. Audited as `vault_search` (metadata has lengths/counts, not raw `q`). |
| GET | `/api/v1/vault/items/<id>` | Access | One credential; password masked. Audited as `vault_view`. |
| POST | `/api/v1/vault/items` | Access | Create: `{ "title", "password", "account_username?", "notes?", "website_url?", "strength_label?" }`. Audited as `vault_create`. |
| PATCH | `/api/v1/vault/items/<id>` | Access | Partial update; only sent fields change. Re-encrypts username/password/notes when those keys are present. Audited as `vault_update`. |
| DELETE | `/api/v1/vault/items/<id>` | Access | Delete if owned. Audited as `vault_delete`. |
| POST | `/api/v1/vault/items/<id>/reveal-password` | Access | Returns `{ "password" }` plaintext. Audited as `vault_reveal_password`. |
| POST | `/api/v1/vault/items/<id>/check-strength` | Access | Decrypts in memory, runs analyzer + crack estimate, persists `strength_label` and `last_checked_at`; response has analysis fields **without** the password. Audited as `vault_check_strength`. |

## Admin (`/api/v1/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/admin/dashboard` | `ADMIN` | Snapshot counts: total/active users, password checks and audit events in last 24h. |
| GET | `/api/v1/admin/analytics` | `ADMIN` | Extended metrics: strength histogram, weak-password %, average entropy, breach count, top detected patterns, last-14-days checks/breaches per day, top users by check volume. |
| GET | `/api/v1/admin/audit-logs` | `ADMIN` | Paginated audit trail. Query: `page`, `per_page`, `user_id`, `action`, `entity` (substring match), `date_from` / `date_to` (YYYY-MM-DD UTC), `q` (action or entity). Metadata is **sanitized** (no passwords or vault secrets). |
| GET | `/api/v1/admin/audit-logs/export.csv` | `ADMIN` | Same filters as JSON list; UTF-8 CSV up to 5000 rows; sanitized metadata column. Rate-limited. |
| GET | `/api/v1/admin/security/activity` | `ADMIN` | Summary: failed logins (24h + window), password-check audit counts, vault audit counts, recent failed-login rows (sanitized). Query: `days` (1–90, default 7). |
| GET | `/api/v1/admin/security-summaries` | `ADMIN` | Aggregate strength counts and breach flags (subset of analytics). |
| GET | `/api/v1/admin/users` | `ADMIN` | Directory of users (no password material). |
| PATCH | `/api/v1/admin/users/<id>` | `ADMIN` | Update `role` and/or `status`. |

## Response headers

All responses include baseline hardening headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) — see `backend/app/__init__.py`.

## Errors

Unhandled server errors return a generic JSON body (`{"msg": "An unexpected error occurred."}`) unless the app runs in **debug** mode. Database and rate-limit failures use dedicated safe messages — see `backend/app/errors.py`.
