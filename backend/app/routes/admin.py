from __future__ import annotations

import csv
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from io import StringIO

from flask import Blueprint, Response, jsonify, request
from sqlalchemy import func

from app.extensions import db, limiter
from app.models import AuditLog, PasswordCheck, User, UserRole, UserStatus
from app.security.rbac import role_required
from app.services.admin_audit_query import audit_logs_filtered_query
from app.services.audit_sanitize import audit_metadata_json_for_csv, serialize_audit_row_public
from app.services.audit_service import write_audit
from app.utils.validation import parse_json_dict

admin_bp = Blueprint("admin", __name__)


def _admin_id() -> int:
    from flask_jwt_extended import get_jwt_identity

    return int(get_jwt_identity())


@admin_bp.get("/dashboard")
@role_required("ADMIN")
def dashboard():
    """High-level counts for admin dashboard."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=1)
    total_users = User.query.count()
    active_users = User.query.filter_by(status=UserStatus.ACTIVE).count()
    checks_24h = PasswordCheck.query.filter(PasswordCheck.created_at >= since).count()
    audits_24h = AuditLog.query.filter(AuditLog.created_at >= since).count()
    admin_id = _admin_id()
    write_audit(
        user_id=admin_id,
        action="admin_dashboard_view",
        entity="admin",
        entity_id=None,
        metadata={"window_hours": 24},
    )
    db.session.commit()
    return jsonify(
        {
            "total_users": total_users,
            "active_users": active_users,
            "password_checks_last_24h": checks_24h,
            "audit_events_last_24h": audits_24h,
        }
    )


@admin_bp.get("/analytics")
@role_required("ADMIN")
def analytics():
    """Combined admin metrics: user counts, recent activity, password-check aggregates."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=1)
    total_users = User.query.count()
    active_users = User.query.filter_by(status=UserStatus.ACTIVE).count()
    checks_24h = PasswordCheck.query.filter(PasswordCheck.created_at >= since).count()
    audits_24h = AuditLog.query.filter(AuditLog.created_at >= since).count()

    rows = (
        db.session.query(PasswordCheck.strength_label, func.count(PasswordCheck.id))
        .group_by(PasswordCheck.strength_label)
        .all()
    )
    by_label = {label: int(n) for label, n in rows if label is not None}
    breached = PasswordCheck.query.filter_by(is_breached=True).count()
    total_checks = PasswordCheck.query.count()

    weak_labels = {"very_weak", "weak"}
    weak_n = sum(by_label.get(l, 0) for l in weak_labels)
    weak_pct = round(100.0 * weak_n / total_checks, 2) if total_checks else 0.0

    avg_entropy_row = db.session.query(func.avg(PasswordCheck.entropy_score)).scalar()
    avg_entropy = float(avg_entropy_row) if avg_entropy_row is not None else None

    pattern_rows = (
        db.session.query(PasswordCheck.detected_patterns)
        .filter(PasswordCheck.detected_patterns.isnot(None))
        .all()
    )
    pattern_ctr: Counter[str] = Counter()
    for (patterns,) in pattern_rows:
        if isinstance(patterns, list):
            for p in patterns:
                if isinstance(p, str) and p.strip():
                    pattern_ctr[p.strip()] += 1
    top_detected_patterns = [{"pattern": k, "count": int(v)} for k, v in pattern_ctr.most_common(15)]

    day_list = []
    for i in range(13, -1, -1):
        day_list.append((now - timedelta(days=i)).date())
    start_dt = datetime.combine(day_list[0], datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(day_list[-1] + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    ts_rows = (
        PasswordCheck.query.with_entities(PasswordCheck.created_at, PasswordCheck.is_breached)
        .filter(PasswordCheck.created_at >= start_dt, PasswordCheck.created_at < end_dt)
        .all()
    )
    buckets: defaultdict = defaultdict(lambda: {"checks": 0, "breaches": 0})
    for created_at, is_breached in ts_rows:
        if created_at is None:
            continue
        if created_at.tzinfo is None:
            day = created_at.date()
        else:
            day = created_at.astimezone(timezone.utc).date()
        buckets[day]["checks"] += 1
        if is_breached:
            buckets[day]["breaches"] += 1
    checks_per_day = []
    for d in day_list:
        b = buckets.get(d, {"checks": 0, "breaches": 0})
        checks_per_day.append({"date": d.isoformat(), "checks": b["checks"], "breaches": b["breaches"]})

    vol_rows = (
        db.session.query(User.id, User.name, User.email, func.count(PasswordCheck.id).label("cnt"))
        .join(PasswordCheck, PasswordCheck.user_id == User.id)
        .group_by(User.id)
        .order_by(func.count(PasswordCheck.id).desc())
        .limit(10)
        .all()
    )
    users_by_check_volume = [
        {"user_id": int(r.id), "name": r.name, "email": r.email, "password_checks": int(r.cnt)} for r in vol_rows
    ]

    admin_id = _admin_id()
    write_audit(
        user_id=admin_id,
        action="admin_analytics_view",
        entity="admin",
        entity_id=None,
        metadata={"window_hours": 24},
    )
    db.session.commit()
    return jsonify(
        {
            "window_hours": 24,
            "users": {"total": total_users, "active": active_users},
            "last_24h": {
                "password_checks": checks_24h,
                "audit_events": audits_24h,
            },
            "password_checks_all_time": {
                "total": total_checks,
                "with_breach_flag": breached,
                "by_strength_label": by_label,
                "weak_password_pct": weak_pct,
                "avg_entropy": avg_entropy,
            },
            "top_detected_patterns": top_detected_patterns,
            "checks_per_day": checks_per_day,
            "users_by_check_volume": users_by_check_volume,
        }
    )


@admin_bp.get("/audit-logs")
@role_required("ADMIN")
def audit_logs():
    page = max(1, int(request.args.get("page", 1)))
    per = min(100, max(1, int(request.args.get("per_page", 50))))
    q = audit_logs_filtered_query(request)
    total = q.count()
    rows = q.offset((page - 1) * per).limit(per).all()
    admin_id = _admin_id()
    write_audit(
        user_id=admin_id,
        action="admin_audit_logs_view",
        entity="admin",
        entity_id=None,
        metadata={
            "page": page,
            "per_page": per,
            "filters": {
                "user_id": request.args.get("user_id"),
                "action": request.args.get("action"),
                "entity": request.args.get("entity"),
                "date_from": request.args.get("date_from"),
                "date_to": request.args.get("date_to"),
                "q": request.args.get("q"),
            },
        },
    )
    db.session.commit()
    out = [serialize_audit_row_public(r) for r in rows]
    return jsonify({"items": out, "page": page, "per_page": per, "total": total})


@admin_bp.get("/audit-logs/export.csv")
@role_required("ADMIN")
@limiter.limit("20 per minute")
def audit_logs_export_csv():
    """CSV export of filtered audit rows (sanitized metadata; admin only)."""
    q = audit_logs_filtered_query(request)
    cap = 5000
    rows = q.limit(cap).all()
    admin_id = _admin_id()
    write_audit(
        user_id=admin_id,
        action="admin_audit_logs_export_csv",
        entity="admin",
        entity_id=None,
        metadata={"row_cap": cap, "returned": len(rows)},
    )
    db.session.commit()

    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "id",
            "created_at",
            "user_id",
            "action",
            "entity",
            "entity_id",
            "ip_address",
            "user_agent",
            "metadata_json_sanitized",
        ]
    )
    for r in rows:
        w.writerow(
            [
                r.id,
                r.created_at.isoformat() if r.created_at else "",
                r.user_id if r.user_id is not None else "",
                r.action,
                r.entity,
                r.entity_id if r.entity_id is not None else "",
                r.ip_address or "",
                ((r.user_agent or "")[:500]),
                audit_metadata_json_for_csv(r.audit_metadata),
            ]
        )
    payload = "\ufeff" + buf.getvalue()
    return Response(
        payload,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="audit_logs_export.csv"'},
    )


@admin_bp.get("/security/activity")
@role_required("ADMIN")
def security_activity():
    """Aggregated security-relevant audit metrics (no secrets)."""
    days = min(90, max(1, int(request.args.get("days", 7))))
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    since_24h = now - timedelta(hours=24)
    admin_id = _admin_id()

    failed_24h = AuditLog.query.filter(
        AuditLog.action == "login_failed",
        AuditLog.created_at >= since_24h,
    ).count()
    failed_window = AuditLog.query.filter(
        AuditLog.action == "login_failed",
        AuditLog.created_at >= since,
    ).count()

    pw_actions = ("password_check", "password_generate", "hash_demo")
    pw_total = AuditLog.query.filter(AuditLog.action.in_(pw_actions), AuditLog.created_at >= since).count()
    pw_rows = (
        db.session.query(AuditLog.action, func.count(AuditLog.id))
        .filter(AuditLog.created_at >= since, AuditLog.action.in_(pw_actions))
        .group_by(AuditLog.action)
        .all()
    )
    password_by_action = {str(a): int(n) for a, n in pw_rows}

    vault_total = AuditLog.query.filter(AuditLog.created_at >= since, AuditLog.action.like("vault_%")).count()
    vault_rows = (
        db.session.query(AuditLog.action, func.count(AuditLog.id))
        .filter(AuditLog.created_at >= since, AuditLog.action.like("vault_%"))
        .group_by(AuditLog.action)
        .all()
    )
    vault_by_action = {str(a): int(n) for a, n in vault_rows}

    recent_failed = (
        AuditLog.query.filter(AuditLog.action == "login_failed")
        .order_by(AuditLog.created_at.desc())
        .limit(20)
        .all()
    )

    write_audit(
        user_id=admin_id,
        action="admin_security_activity_view",
        entity="admin",
        entity_id=None,
        metadata={"days": days},
    )
    db.session.commit()

    return jsonify(
        {
            "window_days": days,
            "failed_logins": {"last_24h": failed_24h, "in_window": failed_window},
            "password_activity": {
                "total_events": int(pw_total),
                "by_action": password_by_action,
            },
            "vault_activity": {
                "total_events": int(vault_total),
                "by_action": vault_by_action,
            },
            "recent_failed_logins": [serialize_audit_row_public(r) for r in recent_failed],
        }
    )


@admin_bp.get("/security-summaries")
@role_required("ADMIN")
def security_summaries():
    """
    Aggregated password-check statistics (no raw passwords; DB never stored them).
    """
    rows = (
        db.session.query(PasswordCheck.strength_label, func.count(PasswordCheck.id))
        .group_by(PasswordCheck.strength_label)
        .all()
    )
    by_label = {label: int(n) for label, n in rows}
    breached = PasswordCheck.query.filter_by(is_breached=True).count()
    total_checks = PasswordCheck.query.count()
    admin_id = _admin_id()
    write_audit(
        user_id=admin_id,
        action="admin_security_summary_view",
        entity="admin",
        entity_id=None,
        metadata=None,
    )
    db.session.commit()
    return jsonify(
        {
            "total_password_checks": total_checks,
            "checks_with_breach_flag": breached,
            "checks_by_strength_label": by_label,
        }
    )


@admin_bp.get("/users")
@role_required("ADMIN")
def list_users():
    admin_id = _admin_id()
    write_audit(
        user_id=admin_id,
        action="admin_users_list",
        entity="admin",
        entity_id=None,
        metadata=None,
    )
    db.session.commit()
    rows = []
    for u in User.query.order_by(User.id).all():
        rows.append(
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role.value if hasattr(u.role, "value") else str(u.role),
                "status": u.status.value if hasattr(u.status, "value") else str(u.status),
                "is_two_factor_enabled": u.is_two_factor_enabled,
            }
        )
    return jsonify({"users": rows})


@admin_bp.patch("/users/<int:user_id>")
@role_required("ADMIN")
def patch_user(user_id: int):
    target = db.session.get(User, user_id)
    if target is None:
        return jsonify({"msg": "not found"}), 404
    raw = request.get_json(silent=True)
    data = parse_json_dict(raw)
    if data is None:
        return jsonify({"msg": "expected a JSON object"}), 400

    updated = []
    if "role" in data:
        try:
            target.role = UserRole(str(data["role"]).upper())
        except ValueError:
            return jsonify({"msg": "invalid role"}), 400
        updated.append("role")
    if "status" in data:
        try:
            target.status = UserStatus(str(data["status"]).upper())
        except ValueError:
            return jsonify({"msg": "invalid status"}), 400
        updated.append("status")
    if not updated:
        return jsonify({"msg": "no valid fields"}), 400

    admin_id = _admin_id()
    write_audit(
        user_id=admin_id,
        action="admin_user_update",
        entity="user",
        entity_id=user_id,
        metadata={"fields": updated},
    )
    db.session.commit()
    return jsonify(
        {
            "id": target.id,
            "name": target.name,
            "email": target.email,
            "role": target.role.value,
            "status": target.status.value,
        }
    )
