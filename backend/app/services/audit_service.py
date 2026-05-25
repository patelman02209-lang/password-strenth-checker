"""Centralized audit logging (never log passwords or decrypted secrets)."""
from __future__ import annotations

from typing import Any

from flask import has_request_context, request

from app.extensions import db
from app.models.audit_log import AuditLog


def write_audit(
    *,
    user_id: int | None,
    action: str,
    entity: str,
    entity_id: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """
    Append an audit row. Intended for security-sensitive actions.

    Callers must ensure ``metadata`` never contains plaintext passwords, decrypted
    vault fields, or bearer tokens — prefer action names, counts, and IDs only.
    API responses run metadata through ``audit_sanitize`` before export to clients.
    """
    ip = None
    ua = None
    if has_request_context():
        ip = (request.remote_addr or "")[:45] or None
        ua = (request.headers.get("User-Agent") or "")[:4096] or None
    row = AuditLog(
        user_id=user_id,
        action=action[:64],
        entity=entity[:64],
        entity_id=entity_id,
        ip_address=ip,
        user_agent=ua,
        audit_metadata=metadata,
    )
    db.session.add(row)
