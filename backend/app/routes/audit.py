"""User-scoped audit log access (own events only)."""
from __future__ import annotations

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity

from app.extensions import db
from app.models import AuditLog
from app.http_api import api_ok
from app.security.rbac import role_required
from app.services.audit_sanitize import serialize_audit_row_public
from app.services.audit_service import write_audit

audit_bp = Blueprint("audit", __name__)


@audit_bp.get("/me")
@role_required("USER", "ADMIN")
def my_audit_logs():
    """Paginated audit trail for the authenticated user (no other users' rows)."""
    uid = int(get_jwt_identity())
    page = max(1, int(request.args.get("page", 1)))
    per = min(100, max(1, int(request.args.get("per_page", 50))))
    q = AuditLog.query.filter_by(user_id=uid).order_by(AuditLog.created_at.desc())
    total = q.count()
    rows = q.offset((page - 1) * per).limit(per).all()
    write_audit(
        user_id=uid,
        action="audit_self_view",
        entity="audit_log",
        entity_id=None,
        metadata={"page": page, "per_page": per},
    )
    db.session.commit()
    items = [serialize_audit_row_public(r) for r in rows]
    return api_ok({"items": items, "page": page, "per_page": per, "total": total})
