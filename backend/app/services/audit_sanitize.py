"""Redact sensitive fields from audit metadata before API or CSV export.

Used for **defense in depth**: callers should already avoid putting secrets in
``audit_metadata``; this layer strips keys that look sensitive before JSON/CSV export.
"""
from __future__ import annotations

import json
import re
from typing import Any

from app.models.audit_log import AuditLog

_SENSITIVE_KEY = re.compile(
    r"(password|passwd|secret|token|plaintext|cipher|decrypt|bearer|authorization|api_?key|private_?key|"
    r"refresh|access_?token|totp|otp|credential)",
    re.IGNORECASE,
)


def sanitize_audit_metadata(meta: Any, *, _depth: int = 0) -> Any:
    """
    Recursively remove or replace values that could carry secrets.
    Keys matching sensitive patterns are replaced with ``[redacted]``.
    Very long strings are truncated to limit accidental leakage.
    """
    if _depth > 12:
        return "[max_depth]"
    if meta is None:
        return None
    if isinstance(meta, dict):
        out: dict[str, Any] = {}
        for k, v in meta.items():
            ks = str(k)
            if _SENSITIVE_KEY.search(ks):
                out[ks] = "[redacted]"
            else:
                out[ks] = sanitize_audit_metadata(v, _depth=_depth + 1)
        return out
    if isinstance(meta, list):
        return [sanitize_audit_metadata(x, _depth=_depth + 1) for x in meta]
    if isinstance(meta, str):
        if len(meta) > 2000:
            return meta[:180] + "…[truncated]"
        return meta
    if isinstance(meta, (int, float, bool)):
        return meta
    return str(meta)[:500]


def audit_metadata_json_for_csv(meta: Any) -> str:
    """Compact JSON for CSV cell (sanitized)."""
    try:
        return json.dumps(sanitize_audit_metadata(meta), separators=(",", ":"), default=str)[:8000]
    except (TypeError, ValueError):
        return ""


def serialize_audit_row_public(r: AuditLog) -> dict[str, Any]:
    """Safe dict for JSON/CSV (no plaintext passwords or vault secrets in metadata)."""
    ua = (r.user_agent or "")[:240] + ("…" if r.user_agent and len(r.user_agent) > 240 else "")
    return {
        "id": r.id,
        "user_id": r.user_id,
        "action": r.action,
        "entity": r.entity,
        "entity_id": r.entity_id,
        "ip_address": r.ip_address,
        "user_agent": ua or None,
        "metadata": sanitize_audit_metadata(r.audit_metadata),
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
