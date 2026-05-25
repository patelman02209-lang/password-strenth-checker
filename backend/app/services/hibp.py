"""
Have I Been Pwned (HIBP) Pwned Passwords API — k-anonymity range lookup.

Contract (https://haveibeenpwned.com/API/v3#PwnedPasswords):
- SHA-1 hash the password **locally** (never send plaintext).
- Send only the **first 5 hex characters** of the SHA-1 digest in the URL path.
- The API returns **all suffixes** (remaining 35 hex chars) in that bucket with
  occurrence counts; the client finds the matching suffix **locally**.

``hashlib.sha1(..., usedforsecurity=False)`` is required by this API and hash-list
formats; it is **not** used for TLS or for storing user credentials.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass

import requests

HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/"


def sha1_hex_upper(password: str) -> str:
    """Full SHA-1 digest of ``password`` as uppercase hex (40 chars). Never logged here."""
    return hashlib.sha1(password.encode("utf-8"), usedforsecurity=False).hexdigest().upper()


@dataclass(frozen=True)
class HibpRangeResult:
    """Outcome of a single range GET (one hash prefix bucket)."""

    ok: bool
    """True if HTTP succeeded and the body was parsed."""
    breach_count: int
    """Occurrence count when ``ok`` and hash suffix matched; 0 when ``ok`` and not listed."""
    http_status: int | None
    error: str | None
    """Short machine-readable reason when ``ok`` is False (timeout, HTTP error, parse error)."""


def query_pwned_range(prefix5: str, suffix35: str, *, timeout: float | tuple[float, float], base_url: str) -> HibpRangeResult:
    """
    Query HIBP for one bucket. ``prefix5`` must be exactly 5 hex chars; ``suffix35`` the remaining 35.

    No password is accepted here — only precomputed hex fragments — so call sites
    that hold the password should hash first and never log those fragments together
    with the password.
    """
    prefix5 = prefix5.upper()
    suffix35 = suffix35.upper()
    if len(prefix5) != 5 or len(suffix35) != 35:
        return HibpRangeResult(False, 0, None, "invalid_hash_parts")

    url = f"{base_url.rstrip('/')}/{prefix5}"
    try:
        resp = requests.get(
            url,
            timeout=timeout,
            headers={
                "User-Agent": "PSC-PasswordChecker/1.0 (k-anonymity range API)",
                # HIBP supports response padding so all range buckets look similar in size,
                # reducing the ability to infer which 5-hex prefix was queried from traffic shape alone.
                "Add-Padding": "true",
            },
        )
    except requests.Timeout as exc:
        return HibpRangeResult(False, 0, None, f"timeout:{type(exc).__name__}")
    except requests.RequestException as exc:
        return HibpRangeResult(False, 0, None, f"transport:{type(exc).__name__}")

    if resp.status_code == 429:
        return HibpRangeResult(False, 0, resp.status_code, "rate_limited")
    if resp.status_code != 200:
        return HibpRangeResult(False, 0, resp.status_code, f"http_{resp.status_code}")

    try:
        text = resp.text
    except Exception as exc:  # pragma: no cover
        return HibpRangeResult(False, 0, resp.status_code, f"read_body:{type(exc).__name__}")

    for line in text.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        part, _, count_s = line.partition(":")
        part = part.strip().upper()
        if part != suffix35:
            continue
        try:
            return HibpRangeResult(True, int(count_s.strip()), resp.status_code, None)
        except ValueError:
            return HibpRangeResult(False, 0, resp.status_code, "invalid_count_line")
    return HibpRangeResult(True, 0, resp.status_code, None)


def lookup_pwned_password(password: str, timeout: float | tuple[float, float] = 5.0) -> HibpRangeResult:
    """
    SHA-1 hash ``password`` locally, query the k-anonymity range API, match suffix locally.

    The plaintext password is **never** placed in the URL or request body.
    """
    digest = sha1_hex_upper(password)
    return query_pwned_range(digest[:5], digest[5:], timeout=timeout, base_url=HIBP_RANGE_URL)


def lookup_pwned_count(password: str, timeout: float | tuple[float, float] = 5.0) -> int:
    """
    Backward-compatible helper: breach count, ``0`` if absent, ``-1`` if the API could not be used.

    Prefer ``lookup_pwned_password`` or ``breach_check.check_password_breach`` for structured errors.
    """
    r = lookup_pwned_password(password, timeout=timeout)
    if not r.ok:
        return -1
    return r.breach_count
