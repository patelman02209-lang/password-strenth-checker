"""
Structured input validation for API payloads.

Return (value, None) on success or (None, error_message) on failure so routes
can return uniform 400 responses without leaking validation internals.
"""
from __future__ import annotations

import re
from typing import Any

from app.utils.sanitize import strip_control_characters

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]{3,80}$")

# Upper bound for strength / breach / demo endpoints (DoS mitigation).
MAX_PASSWORD_CHECK_LENGTH = 4096


def parse_json_dict(data: Any) -> dict[str, Any] | None:
    """Ensure JSON decoded to a dict (not a list/primitive)."""
    if isinstance(data, dict):
        return data
    return None


def validate_username(raw: str | None) -> tuple[str | None, str | None]:
    if raw is None:
        return None, "username is required"
    s = raw.strip()
    if not _USERNAME_RE.match(s):
        return None, "username must be 3–80 characters: letters, digits, . _ -"
    return s, None


def validate_email(raw: str | None) -> tuple[str | None, str | None]:
    if raw is None:
        return None, "email is required"
    s = raw.strip().lower()
    if len(s) > 255 or not _EMAIL_RE.match(s):
        return None, "invalid email format"
    return s, None


def validate_password_policy(raw: str | None, min_len: int = 10) -> tuple[str | None, str | None]:
    """
    Minimum length only at the API boundary; strength scoring lives in the analyzer.

    Reject empty / whitespace-only passwords explicitly.
    """
    if raw is None or not isinstance(raw, str):
        return None, "password is required"
    if len(raw) < min_len:
        return None, f"password must be at least {min_len} characters"
    if raw.strip() != raw:
        return None, "password must not have leading or trailing whitespace"
    return raw, None


def validate_non_empty_string(raw: str | None, field: str, max_len: int = 500) -> tuple[str | None, str | None]:
    if raw is None:
        return None, f"{field} is required"
    s = raw.strip()
    if not s:
        return None, f"{field} must not be empty"
    if len(s) > max_len:
        return None, f"{field} is too long"
    return s, None


def validate_display_name(raw: str | None) -> tuple[str | None, str | None]:
    """Public profile / login name (same rules as `validate_username`)."""
    return validate_username(raw)


def validate_password_check_input(raw: Any) -> tuple[str | None, str | None]:
    """
    Non-registration password payloads (analyze, HIBP, demos).

    Strips ASCII control characters; enforces max length. Empty after cleaning → error.
    """
    if raw is None or not isinstance(raw, str):
        return None, "password is required"
    cleaned = strip_control_characters(raw)
    if not cleaned:
        return None, "password must not be empty"
    if len(cleaned) > MAX_PASSWORD_CHECK_LENGTH:
        return None, f"password exceeds maximum length ({MAX_PASSWORD_CHECK_LENGTH})"
    return cleaned, None
