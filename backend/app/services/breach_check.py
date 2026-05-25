"""
Unified breach checking: HIBP k-anonymity first, optional local hash-list fallback.

Plaintext passwords are only held in memory for the duration of the call; they are
never written to logs or databases from this module.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.breach_local import check_local_file
from app.services.hibp import lookup_pwned_password


@dataclass(frozen=True)
class BreachCheckResult:
    """Result safe to return in JSON and to persist as metadata (counts/flags only)."""

    found: bool
    breach_count: int
    """Best-effort occurrence count; ``0`` if not found or unknown."""
    source: str
    """``hibp`` | ``local_fallback`` | ``none`` (no positive match from any consulted source)."""
    hibp_ok: bool
    hibp_error: str | None
    local_checked: bool
    local_found: bool


def check_password_breach(
    password: str,
    *,
    local_file_path: str | None,
    timeout: float | tuple[float, float],
) -> BreachCheckResult:
    """
    Check whether ``password`` appears in known breaches.

    1. **HIBP** — SHA-1 locally; request range by 5-hex prefix only; match 35-char suffix locally.
    2. If HIBP fails (timeout, HTTP error, parse error) and ``local_file_path`` is set, **scan the local
       file** (same SHA-1 format as `haveibeenpwned-downloader` / HIBP hash lists: ``HASH`` or ``HASH:count``).

    If HIBP succeeds, its count is authoritative (local is not re-queried unless you call it separately).
    """
    hibp = lookup_pwned_password(password, timeout=timeout)
    if hibp.ok:
        return BreachCheckResult(
            found=hibp.breach_count > 0,
            breach_count=hibp.breach_count,
            source="hibp",
            hibp_ok=True,
            hibp_error=None,
            local_checked=False,
            local_found=False,
        )

    if local_file_path:
        local: dict[str, Any] = check_local_file(password, local_file_path)
        if local.get("enabled") and local.get("found"):
            cnt = int(local.get("breach_count") or 1)
            return BreachCheckResult(
                found=True,
                breach_count=cnt,
                source="local_fallback",
                hibp_ok=False,
                hibp_error=hibp.error,
                local_checked=True,
                local_found=True,
            )
        return BreachCheckResult(
            found=False,
            breach_count=0,
            source="local_fallback" if local.get("enabled") else "none",
            hibp_ok=False,
            hibp_error=hibp.error,
            local_checked=bool(local.get("enabled")),
            local_found=False,
        )

    return BreachCheckResult(
        found=False,
        breach_count=0,
        source="none",
        hibp_ok=False,
        hibp_error=hibp.error,
        local_checked=False,
        local_found=False,
    )
