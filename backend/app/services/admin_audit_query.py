"""Build filtered AuditLog queries for admin APIs (no secrets in query logic).

All filters use SQLAlchemy column expressions (``.filter``, ``.ilike``) so values are
**bound parameters** — never string-interpolated into raw SQL (SQL injection safe).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from flask import Request
from sqlalchemy import or_

from app.models import AuditLog


def _parse_day_start(s: str | None) -> datetime | None:
    if not s or not str(s).strip():
        return None
    raw = str(s).strip()[:10]
    try:
        d = datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return None
    return datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc)


def _parse_day_end_exclusive(s: str | None) -> datetime | None:
    if not s or not str(s).strip():
        return None
    raw = str(s).strip()[:10]
    try:
        d = datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return None
    return datetime.combine(d + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)


def audit_logs_filtered_query(request: Request):
    """
    Return SQLAlchemy query ordered by created_at desc with optional filters.

    Query params:
    - user_id: int (exact)
    - action: substring match (case-insensitive)
    - entity: substring match (case-insensitive)
    - date_from, date_to: YYYY-MM-DD inclusive (UTC day bounds)
    - q: search action OR entity (substring)
    """
    q = AuditLog.query

    uid_raw = request.args.get("user_id")
    if uid_raw is not None and str(uid_raw).strip() != "":
        try:
            uid = int(uid_raw)
            q = q.filter(AuditLog.user_id == uid)
        except ValueError:
            pass

    action = (request.args.get("action") or "").strip()
    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))

    entity = (request.args.get("entity") or "").strip()
    if entity:
        q = q.filter(AuditLog.entity.ilike(f"%{entity}%"))

    df = _parse_day_start(request.args.get("date_from"))
    if df is not None:
        q = q.filter(AuditLog.created_at >= df)

    dt = _parse_day_end_exclusive(request.args.get("date_to"))
    if dt is not None:
        q = q.filter(AuditLog.created_at < dt)

    search = (request.args.get("q") or "").strip()
    if search:
        term = f"%{search}%"
        q = q.filter(or_(AuditLog.action.ilike(term), AuditLog.entity.ilike(term)))

    return q.order_by(AuditLog.created_at.desc())
