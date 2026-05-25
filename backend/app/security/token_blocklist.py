"""In-memory JWT JTI denylist for logout (use Redis-backed storage for multi-worker production).

``revoke_jti`` is invoked from ``/auth/logout`` (access token) and optionally the
refresh token body so leaked tokens cannot be reused after sign-out. **Refresh**
endpoint issues a **new** access token only; clients should replace stored access
tokens and treat refresh tokens as sensitive bearer secrets (HTTPS only).

Production: replace this module with Redis + TTL matching token ``exp`` claims.
"""
from __future__ import annotations

# Revoked access (and optionally refresh) token JTIs until process restart.
_revoked_jtis: set[str] = set()
_MAX_ENTRIES = 50_000


def revoke_jti(jti: str | None) -> None:
    if not jti:
        return
    if len(_revoked_jtis) >= _MAX_ENTRIES:
        _revoked_jtis.clear()
    _revoked_jtis.add(jti)


def is_jti_revoked(jti: str | None) -> bool:
    return bool(jti) and jti in _revoked_jtis


def clear_revoked_for_tests() -> None:
    """Test hook only."""
    _revoked_jtis.clear()
