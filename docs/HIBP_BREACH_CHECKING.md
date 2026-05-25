# Have I Been Pwned (HIBP) breach checking

This project checks passwords against the **Pwned Passwords** dataset using Troy Hunt’s **k-anonymity** range API, with an optional **local hash file** fallback when the API is unreachable.

## How k-anonymity protects the password

1. The server (or browser) computes **SHA-1(password)** locally. The plaintext password is **never** placed in the URL, query string, or request body sent to Have I Been Pwned.
2. Only the **first 5 hexadecimal characters** of the digest (the **prefix**) are used in the HTTPS request path, e.g. `GET https://api.pwnedpasswords.com/range/ABCDE`.
3. HIBP responds with **all hashes** in their database that share that prefix: each line is a **35-character suffix** (the rest of the SHA-1) plus an **occurrence count** (how many times that hash appeared in aggregated breach data).
4. Your application **compares the remaining 35 characters locally** to those lines. The full hash is reassembled only in memory on your side; HIBP does not receive the suffix from you in the request.

Because **16^5 ≈ 1,048,576** buckets exist, each prefix corresponds to a large class of passwords. An observer of TLS (or HIBP’s logs) sees only a prefix, not your password or your full hash.

**Limits:** k-anonymity reduces what is *sent*; it does not prove that HIBP’s server never learns anything in the strong cryptographic sense. The model is the one [documented by HIBP](https://haveibeenpwned.com/API/v3#PwnedPasswords). We also send the `Add-Padding: true` header so response sizes are less correlated with bucket population (optional hardening recommended by HIBP).

## What data is sent externally

| Data | Sent? | Where |
|------|--------|--------|
| Plaintext password | **No** | — |
| Full SHA-1 hash | **No** | — |
| First **5** hex chars of SHA-1 | **Yes** | URL path only (`/range/{prefix}`) |
| User-Agent string | **Yes** | HTTP header |
| `Add-Padding: true` | **Yes** | HTTP header |

The response body contains **only** suffixes and counts for that prefix bucket (public breach aggregate data).

## What is never sent

- The **plaintext password**
- The **full SHA-1** digest
- The **35-character suffix** in the HTTP request (it is compared **after** download, on your machine)

This codebase does **not** log request bodies containing passwords (see `LOG_REQUEST_BODY` in configuration — must stay disabled in production).

## Timeout and error handling

- HTTP calls use configurable **connect** and **read** timeouts (`HIBP_CONNECT_TIMEOUT`, `HIBP_TIMEOUT` in the environment / `Config`).
- Network failures, non-200 responses, malformed lines, and HTTP **429** rate limiting are surfaced as structured errors in API responses (`hibp_error`, `hibp_ok`) without leaking the password.

## Local breach list (fallback)

If HIBP cannot be reached (or returns an error we treat as failure), the app can optionally scan **`LOCAL_BREACH_FILE`**: a text file with one SHA-1 hash per line, optionally `HASH:count`, compatible with exports from tools such as **[haveibeenpwned-downloader](https://github.com/HaveIBeenPwned/PwnedPasswordsDownloader)** or similar HIBP hash list formats.

- The password is still **hashed locally** with SHA-1 and compared to lines in the file.
- **Nothing is sent over the network** for this step.
- A linear scan is used; for **very large** files, prefer a sorted corpus with indexing or an external database (documented in `breach_local.py`).

### Fallback semantics

1. Try **HIBP** first. If the call succeeds, the HIBP count is **authoritative** for that global corpus.
2. If HIBP **fails**, and `LOCAL_BREACH_FILE` is set and readable, scan the local file. A match yields `source: local_fallback` and a `breach_count` from the line (`:count` if present, otherwise `1`).
3. If HIBP fails and there is **no** local match (or no file), the API reports `pwned_count: -1` (legacy) / structured fields indicating exposure **could not be confirmed** — not the same as “safe everywhere.”

## Persistence

Password checks that are stored (e.g. authenticated `/analyze` history) persist **only** metadata: scores, labels, breach flags, counts — **never** the evaluated password string.

## Code map

| Piece | Role |
|-------|------|
| `app/services/hibp.py` | SHA-1 locally, GET `/range/{5-hex-prefix}`, parse suffix lines |
| `app/services/breach_local.py` | Optional local `HASH` / `HASH:count` file scan |
| `app/services/breach_check.py` | HIBP first, then local fallback |
| `app/routes/password.py` | `/hibp`, `/analyze`, `/local-breach` endpoints |
