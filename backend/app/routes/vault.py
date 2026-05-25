"""
Encrypted credential vault (per-user Fernet via HKDF from ``VAULT_KDF_PEPPER``).

- Usernames, passwords, and notes are stored only as ciphertext (BLOBs).
- Plaintext exists only briefly in memory during a request.
- List/search responses **omit decrypted passwords** until the client calls the
  dedicated **reveal** endpoint (still scoped to the owning user — IDOR-safe).
"""
from __future__ import annotations

import csv
from datetime import datetime, timezone
from io import StringIO

from flask import Blueprint, Response, current_app, jsonify, request
from sqlalchemy import or_

from app.extensions import db
from app.models import StoredCredential
from app.security.rbac import role_required
from app.services.audit_service import write_audit
from app.services.breach_check import check_password_breach
from app.services.credential_crypto import decrypt_field, encrypt_field
from app.services.crack_time import estimate_crack_seconds
from app.services.password_analyzer import analyze_password
from app.services.vault_privacy import compute_password_reuse_hmac
from app.services.vault_security_report import build_security_report, reuse_group_sizes
from app.utils.sanitize import normalize_optional_text

vault_bp = Blueprint("vault", __name__)


def _as_utc_aware(dt: datetime | None) -> datetime | None:
    """SQLite may return naive datetimes; normalize for safe comparisons."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _uid() -> int:
    from flask_jwt_extended import get_jwt_identity

    return int(get_jwt_identity())


def _get_owned(user_id: int, item_id: int) -> StoredCredential | None:
    """Always scope by ``user_id`` to prevent IDOR."""
    return StoredCredential.query.filter_by(id=item_id, user_id=user_id).first()


def _apply_password_derived_metadata(user_id: int, item: StoredCredential, password: str) -> None:
    """
    Persist analyzer metadata + reuse token + rotation anchor. Plaintext is not stored.
    ``is_breached`` is cleared until an explicit strength check runs HIBP/local breach.
    """
    now = datetime.now(timezone.utc)
    result = analyze_password(password)
    item.strength_label = (result.strength_label or "")[:64] or None
    item.entropy_bits = result.entropy_bits
    item.complexity_score = result.complexity_score
    item.password_reuse_hmac = compute_password_reuse_hmac(user_id, password)
    item.password_set_at = now
    item.is_breached = False


def _serialize_item(
    user_id: int,
    item: StoredCredential,
    *,
    include_password: bool,
    password_reuse_group_size: int = 1,
    password_rotation_max_age_days: int = 180,
) -> dict:
    try:
        u_plain = decrypt_field(user_id, item.username_encrypted)
        if item.notes_encrypted:
            n_plain = decrypt_field(user_id, item.notes_encrypted)
        else:
            n_plain = None
    except ValueError:
        u_plain = "[decryption error]"
        n_plain = None

    if include_password:
        try:
            p_plain = decrypt_field(user_id, item.password_encrypted)
        except ValueError:
            p_plain = "[decryption error]"
    else:
        p_plain = None

    ref = _as_utc_aware(item.password_set_at) or _as_utc_aware(item.created_at)
    password_stale = False
    password_age_days: int | None = None
    if ref is not None:
        password_age_days = (datetime.now(timezone.utc) - ref).days
        password_stale = password_age_days > password_rotation_max_age_days

    return {
        "id": item.id,
        "title": item.title,
        "account_username": u_plain,
        "notes": n_plain,
        "website_url": item.website_url,
        "strength_label": item.strength_label,
        "last_checked_at": item.last_checked_at.isoformat() if item.last_checked_at else None,
        "entropy_bits": item.entropy_bits,
        "complexity_score": item.complexity_score,
        "is_breached": bool(item.is_breached),
        "password_set_at": item.password_set_at.isoformat() if item.password_set_at else None,
        "password_age_days": password_age_days,
        "password_stale": password_stale,
        "password_reuse_group_size": password_reuse_group_size,
        "password_reuse_warning": password_reuse_group_size > 1,
        "password_rotation_max_age_days": password_rotation_max_age_days,
        "password": p_plain,
        "password_hidden": not include_password,
    }


@vault_bp.get("/items")
@role_required("USER", "ADMIN")
def list_items():
    user_id = _uid()
    max_age = int(current_app.config.get("PASSWORD_ROTATION_MAX_AGE_DAYS", 180))
    items = StoredCredential.query.filter_by(user_id=user_id).order_by(StoredCredential.id).all()
    sizes = reuse_group_sizes(items)
    out = [
        _serialize_item(
            user_id,
            it,
            include_password=False,
            password_reuse_group_size=sizes.get(it.id, 1),
            password_rotation_max_age_days=max_age,
        )
        for it in items
    ]
    write_audit(
        user_id=user_id,
        action="vault_list",
        entity="vault",
        entity_id=None,
        metadata={"item_count": len(out)},
    )
    db.session.commit()
    return jsonify({"items": out})


@vault_bp.get("/items/search")
@role_required("USER", "ADMIN")
def search_items():
    user_id = _uid()
    q_raw = (request.args.get("q") or "").strip()
    q = normalize_optional_text(q_raw, 200) or ""
    if not q:
        return jsonify({"msg": "q query parameter is required"}), 400

    pattern = f"%{q}%"
    # ``pattern`` is passed as a bound parameter to the DB driver (not SQL concatenation).
    sql_hits = (
        db.session.query(StoredCredential.id)
        .filter(
            StoredCredential.user_id == user_id,
            or_(
                StoredCredential.title.ilike(pattern),
                StoredCredential.website_url.ilike(pattern),
            ),
        )
        .all()
    )
    matched_ids = {row[0] for row in sql_hits}

    for it in StoredCredential.query.filter_by(user_id=user_id).all():
        if it.id in matched_ids:
            continue
        try:
            u = decrypt_field(user_id, it.username_encrypted)
            if q.lower() in u.lower():
                matched_ids.add(it.id)
        except ValueError:
            continue

    if not matched_ids:
        write_audit(
            user_id=user_id,
            action="vault_search",
            entity="vault",
            entity_id=None,
            metadata={"query_length": len(q), "result_count": 0},
        )
        db.session.commit()
        return jsonify({"items": []})

    items = (
        StoredCredential.query.filter(
            StoredCredential.user_id == user_id,
            StoredCredential.id.in_(matched_ids),
        )
        .order_by(StoredCredential.id)
        .all()
    )
    max_age = int(current_app.config.get("PASSWORD_ROTATION_MAX_AGE_DAYS", 180))
    all_user = StoredCredential.query.filter_by(user_id=user_id).order_by(StoredCredential.id).all()
    sizes = reuse_group_sizes(all_user)
    out = [
        _serialize_item(
            user_id,
            it,
            include_password=False,
            password_reuse_group_size=sizes.get(it.id, 1),
            password_rotation_max_age_days=max_age,
        )
        for it in items
    ]
    write_audit(
        user_id=user_id,
        action="vault_search",
        entity="vault",
        entity_id=None,
        metadata={"query_length": len(q), "result_count": len(out)},
    )
    db.session.commit()
    return jsonify({"items": out})


@vault_bp.get("/items/<int:item_id>")
@role_required("USER", "ADMIN")
def get_item(item_id: int):
    user_id = _uid()
    item = _get_owned(user_id, item_id)
    if item is None:
        return jsonify({"msg": "not found"}), 404
    write_audit(
        user_id=user_id,
        action="vault_view",
        entity="stored_credential",
        entity_id=item_id,
        metadata={"title": (item.title or "")[:120]},
    )
    db.session.commit()
    max_age = int(current_app.config.get("PASSWORD_ROTATION_MAX_AGE_DAYS", 180))
    all_items = StoredCredential.query.filter_by(user_id=user_id).all()
    sizes = reuse_group_sizes(all_items)
    return jsonify(
        _serialize_item(
            user_id,
            item,
            include_password=False,
            password_reuse_group_size=sizes.get(item.id, 1),
            password_rotation_max_age_days=max_age,
        )
    )


@vault_bp.post("/items/<int:item_id>/reveal-password")
@role_required("USER", "ADMIN")
def reveal_password(item_id: int):
    """Return decrypted password only after explicit action (still owner-scoped)."""
    user_id = _uid()
    item = _get_owned(user_id, item_id)
    if item is None:
        return jsonify({"msg": "not found"}), 404
    try:
        pw = decrypt_field(user_id, item.password_encrypted)
    except ValueError:
        return jsonify({"msg": "decryption failed"}), 500
    write_audit(
        user_id=user_id,
        action="vault_reveal_password",
        entity="stored_credential",
        entity_id=item_id,
        metadata=None,
    )
    db.session.commit()
    return jsonify({"password": pw})


@vault_bp.post("/items/<int:item_id>/check-strength")
@role_required("USER", "ADMIN")
def check_stored_strength(item_id: int):
    """Decrypt in memory, analyze, persist only labels/timestamps — never the password."""
    user_id = _uid()
    item = _get_owned(user_id, item_id)
    if item is None:
        return jsonify({"msg": "not found"}), 404
    try:
        pw = decrypt_field(user_id, item.password_encrypted)
    except ValueError:
        return jsonify({"msg": "decryption failed"}), 500

    result = analyze_password(pw)
    crack = estimate_crack_seconds(result.entropy_bits)
    timeout = (
        float(current_app.config["HIBP_CONNECT_TIMEOUT"]),
        float(current_app.config["HIBP_TIMEOUT"]),
    )
    breach = check_password_breach(
        pw,
        local_file_path=current_app.config.get("LOCAL_BREACH_FILE"),
        timeout=timeout,
    )
    item.strength_label = (result.strength_label or "")[:64] or None
    item.last_checked_at = datetime.now(timezone.utc)
    item.entropy_bits = result.entropy_bits
    item.complexity_score = result.complexity_score
    item.is_breached = bool(breach.found)
    item.password_reuse_hmac = compute_password_reuse_hmac(user_id, pw)
    write_audit(
        user_id=user_id,
        action="vault_check_strength",
        entity="stored_credential",
        entity_id=item_id,
        metadata={"strength_label": result.strength_label, "is_breached": item.is_breached},
    )
    db.session.commit()
    return jsonify(
        {
            "strength_label": result.strength_label,
            "complexity_score": result.complexity_score,
            "entropy_bits": result.entropy_bits,
            "patterns": result.patterns,
            "suggestions": result.suggestions,
            "crack_estimate": crack,
            "last_checked_at": item.last_checked_at.isoformat() if item.last_checked_at else None,
            "is_breached": item.is_breached,
            "breach_count": max(0, breach.breach_count),
            "breach_source": breach.source,
            "hibp_ok": breach.hibp_ok,
            "hibp_error": breach.hibp_error,
        }
    )


@vault_bp.post("/items")
@role_required("USER", "ADMIN")
def create_item():
    user_id = _uid()
    data = request.get_json(silent=True) or {}
    title = normalize_optional_text(data.get("title"), 255) or ""
    account_username = normalize_optional_text(data.get("account_username"), 255) or ""
    notes = normalize_optional_text(data.get("notes"), 4000) or ""
    website_url = normalize_optional_text(data.get("website_url"), 512)
    password = data.get("password") or ""
    if not title or not password:
        return jsonify({"msg": "title and password required"}), 400

    item = StoredCredential(
        user_id=user_id,
        title=title,
        username_encrypted=encrypt_field(user_id, account_username or ""),
        password_encrypted=encrypt_field(user_id, password),
        website_url=website_url[:512] if website_url else None,
        notes_encrypted=encrypt_field(user_id, notes) if notes else None,
        strength_label=None,
    )
    _apply_password_derived_metadata(user_id, item, password)
    db.session.add(item)
    db.session.flush()
    write_audit(
        user_id=user_id,
        action="vault_create",
        entity="stored_credential",
        entity_id=item.id,
        metadata={"title": title[:120]},
    )
    db.session.commit()
    return jsonify({"id": item.id}), 201


@vault_bp.patch("/items/<int:item_id>")
@role_required("USER", "ADMIN")
def update_item(item_id: int):
    user_id = _uid()
    item = _get_owned(user_id, item_id)
    if item is None:
        return jsonify({"msg": "not found"}), 404

    data = request.get_json(silent=True) or {}
    updated_fields: list[str] = []

    if "title" in data:
        t = normalize_optional_text(data.get("title"), 255) or ""
        if not t:
            return jsonify({"msg": "title cannot be empty"}), 400
        item.title = t
        updated_fields.append("title")
    if "account_username" in data:
        v = normalize_optional_text(data.get("account_username"), 255) or ""
        item.username_encrypted = encrypt_field(user_id, v)
        updated_fields.append("account_username")
    if "password" in data and data.get("password") is not None:
        pw = data.get("password") or ""
        if not pw:
            return jsonify({"msg": "password cannot be empty"}), 400
        item.password_encrypted = encrypt_field(user_id, pw)
        _apply_password_derived_metadata(user_id, item, pw)
        updated_fields.append("password")
    if "notes" in data:
        raw = data.get("notes")
        if raw is None or raw == "":
            item.notes_encrypted = None
        else:
            n = normalize_optional_text(str(raw), 4000) or ""
            item.notes_encrypted = encrypt_field(user_id, n) if n else None
        updated_fields.append("notes")
    if "website_url" in data:
        w = normalize_optional_text(data.get("website_url"), 512)
        item.website_url = w[:512] if w else None
        updated_fields.append("website_url")
    if "strength_label" in data:
        s = normalize_optional_text(data.get("strength_label"), 64)
        item.strength_label = s[:64] if s else None
        updated_fields.append("strength_label")

    if not updated_fields:
        return jsonify({"msg": "no valid fields to update"}), 400

    write_audit(
        user_id=user_id,
        action="vault_update",
        entity="stored_credential",
        entity_id=item_id,
        metadata={"fields": updated_fields},
    )
    db.session.commit()
    return jsonify({"id": item.id, "updated": updated_fields})


@vault_bp.delete("/items/<int:item_id>")
@role_required("USER", "ADMIN")
def delete_item(item_id: int):
    user_id = _uid()
    item = _get_owned(user_id, item_id)
    if item is None:
        return jsonify({"msg": "not found"}), 404
    db.session.delete(item)
    write_audit(
        user_id=user_id,
        action="vault_delete",
        entity="stored_credential",
        entity_id=item_id,
        metadata=None,
    )
    db.session.commit()
    return jsonify({"msg": "deleted"})


@vault_bp.get("/security-report")
@role_required("USER", "ADMIN")
def security_report():
    """Aggregated vault security metrics (no password fields)."""
    user_id = _uid()
    rows = StoredCredential.query.filter_by(user_id=user_id).order_by(StoredCredential.id).all()
    rep = build_security_report(user_id, rows)
    write_audit(
        user_id=user_id,
        action="vault_security_report",
        entity="vault",
        entity_id=None,
        metadata={"health_score": rep["health_score"], "item_count": len(rows)},
    )
    db.session.commit()
    return jsonify(rep)


@vault_bp.get("/export/security-metadata.csv")
@role_required("USER", "ADMIN")
def export_security_metadata_csv():
    """
    CSV of non-secret vault columns only — no usernames, notes, or passwords decrypted.
    """
    user_id = _uid()
    rows = StoredCredential.query.filter_by(user_id=user_id).order_by(StoredCredential.id).all()
    sizes = reuse_group_sizes(rows)
    max_age = int(current_app.config.get("PASSWORD_ROTATION_MAX_AGE_DAYS", 180))
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "credential_id",
            "title",
            "website_url",
            "strength_label",
            "entropy_bits",
            "complexity_score",
            "is_breached",
            "last_checked_at",
            "password_set_at",
            "password_age_days",
            "password_stale",
            "password_reuse_group_size",
            "password_rotation_policy_days",
        ]
    )
    now = datetime.now(timezone.utc)
    for r in rows:
        ref = _as_utc_aware(r.password_set_at) or _as_utc_aware(r.created_at)
        age = (now - ref).days if ref else ""
        stale = bool(ref and (now - ref).days > max_age)
        w.writerow(
            [
                r.id,
                r.title,
                r.website_url or "",
                r.strength_label or "",
                r.entropy_bits if r.entropy_bits is not None else "",
                r.complexity_score if r.complexity_score is not None else "",
                "yes" if r.is_breached else "no",
                r.last_checked_at.isoformat() if r.last_checked_at else "",
                r.password_set_at.isoformat() if r.password_set_at else "",
                age,
                "yes" if stale else "no",
                sizes.get(r.id, 1),
                max_age,
            ]
        )
    write_audit(
        user_id=user_id,
        action="vault_export_csv",
        entity="vault",
        entity_id=None,
        metadata={"row_count": len(rows)},
    )
    db.session.commit()
    body = buf.getvalue()
    return Response(
        body,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="password-security-metadata.csv"',
            "Cache-Control": "no-store",
        },
    )
