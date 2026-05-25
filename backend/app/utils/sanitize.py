"""
Input sanitization helpers.

These reduce accidental injection into logs/HTML and strip hostile control
characters from user-controlled strings before persistence or display.
"""
from __future__ import annotations

import html
import re

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def strip_control_characters(value: str) -> str:
    """Remove ASCII control characters (excluding tab/newline/carriage return)."""
    return _CONTROL.sub("", value)


def escape_for_log_fragment(value: str, max_len: int = 200) -> str:
    """
    Truncate and neutralize a string for safe inclusion in log lines.

    Never log secrets; this is for identifiers and non-sensitive metadata only.
    """
    truncated = value[:max_len] + ("…" if len(value) > max_len else "")
    return html.escape(truncated, quote=True)


def normalize_optional_text(value: str | None, max_len: int) -> str | None:
    """Strip, remove controls, and truncate optional user text fields."""
    if value is None:
        return None
    cleaned = strip_control_characters(value.strip())
    if not cleaned:
        return None
    return cleaned[:max_len]
