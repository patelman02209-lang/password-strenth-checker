"""
Authentication and two-factor (TOTP) flows.

JWT model:
- **Access** and **refresh** tokens are sent as ``Authorization: Bearer`` values
  (JSON API). The browser does not auto-attach them on cross-site navigations the
  way it does with cookies, which materially reduces CSRF risk for state-changing
  JSON POSTs — still pair with strict CORS and HTTPS.
- **Logout** revokes the current access JTI (and optional refresh body) via the
  in-memory denylist; use a shared Redis-backed store for multi-worker revocation.

Security notes (high level):
- Default password storage uses **bcrypt**; **Argon2id** is optional via
  ``PASSWORD_HASH_DEFAULT=argon2id``. Verification supports both formats.
- TOTP secrets live in `two_factor_secret` and are only returned during enrollment.
- Short-lived JWTs mark the gap between password verification and OTP completion.
"""
from __future__ import annotations

import base64
import io
from datetime import timedelta

import pyotp
import qrcode
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from jwt.exceptions import InvalidTokenError

from app.extensions import db, limiter
from app.models import StoredCredential, User, UserRole, UserStatus
from app.security.rbac import jwt_full, role_required
from app.security.token_blocklist import revoke_jti
from app.services.audit_service import write_audit
from app.services.vault_security_report import build_security_report
from app.utils.sanitize import strip_control_characters
from app.utils.validation import (
    parse_json_dict,
    validate_display_name,
    validate_email,
    validate_password_policy,
)

auth_bp = Blueprint("auth", __name__)


def _issue_full_tokens(user: User) -> dict:
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    access = create_access_token(
        identity=str(user.id),
        additional_claims={"twofa_pending": False, "role": role_val},
        expires_delta=current_app.config["JWT_ACCESS_TOKEN_EXPIRES"],
    )
    refresh = create_refresh_token(identity=str(user.id))
    return {"access_token": access, "refresh_token": refresh}


@auth_bp.post("/register")
@limiter.limit("10 per minute")
def register():
    raw = request.get_json(silent=True)
    data = parse_json_dict(raw)
    if data is None:
        return jsonify({"msg": "expected a JSON object"}), 400

    name, nerr = validate_display_name(data.get("name") or data.get("username"))
    if nerr:
        return jsonify({"msg": nerr}), 400
    email, eerr = validate_email(data.get("email"))
    if eerr:
        return jsonify({"msg": eerr}), 400
    password, perr = validate_password_policy(data.get("password"))
    if perr:
        return jsonify({"msg": perr}), 400

    if User.query.filter_by(email=email).first():
        # Do not reveal whether the email is already registered (enumeration).
        return jsonify({"msg": "Unable to complete registration with the provided information."}), 400

    user = User(name=name, email=email, role=UserRole.USER, status=UserStatus.ACTIVE)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    write_audit(
        user_id=user.id,
        action="register",
        entity="user",
        entity_id=user.id,
        metadata={"email_domain": email.split("@")[-1]},
    )
    db.session.commit()
    return jsonify({"msg": "created", "user_id": user.id}), 201


@auth_bp.post("/login")
@limiter.limit("10 per minute")
def login():
    data = request.get_json(silent=True) or {}
    identifier_raw = (data.get("username") or data.get("name") or data.get("email") or "").strip()
    identifier = strip_control_characters(identifier_raw)
    password = data.get("password") or ""
    if not identifier or not password:
        return jsonify({"msg": "missing credentials"}), 400

    user = User.query.filter(
        (User.name == identifier) | (User.email == identifier.lower())
    ).first()
    if user is None or not user.check_password(password):
        write_audit(
            user_id=None,
            action="login_failed",
            entity="user",
            entity_id=None,
            metadata={"identifier_type": "email" if "@" in identifier else "name"},
        )
        db.session.commit()
        return jsonify({"msg": "bad credentials"}), 401

    if user.status != UserStatus.ACTIVE:
        write_audit(
            user_id=user.id,
            action="login_failed",
            entity="user",
            entity_id=user.id,
            metadata={"reason": "inactive"},
        )
        db.session.commit()
        return jsonify({"msg": "bad credentials"}), 401

    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    if user.is_two_factor_enabled:
        pending = create_access_token(
            identity=str(user.id),
            additional_claims={"twofa_pending": True, "role": role_val},
            expires_delta=timedelta(minutes=5),
        )
        return jsonify({"two_factor_required": True, "pending_token": pending}), 200

    write_audit(user_id=user.id, action="login", entity="user", entity_id=user.id, metadata=None)
    db.session.commit()
    return jsonify(_issue_full_tokens(user)), 200


@auth_bp.post("/two_factor/verify")
@limiter.limit("30 per minute")
def two_factor_verify():
    verify_header = request.headers.get("Authorization", "")
    if not verify_header.startswith("Bearer "):
        return jsonify({"msg": "missing bearer token"}), 401

    token = verify_header.split(" ", 1)[1]
    try:
        decoded = decode_token(token)
    except InvalidTokenError:
        return jsonify({"msg": "invalid token"}), 401
    if not decoded.get("twofa_pending"):
        return jsonify({"msg": "pending 2fa token required"}), 400

    user = db.session.get(User, int(decoded["sub"]))
    if user is None or not user.two_factor_secret:
        return jsonify({"msg": "2fa not configured"}), 400

    body = request.get_json(silent=True) or {}
    code = (body.get("code") or "").replace(" ", "")
    totp = pyotp.TOTP(user.two_factor_secret)
    if not totp.verify(code, valid_window=1):
        return jsonify({"msg": "invalid code"}), 401

    write_audit(user_id=user.id, action="two_factor_login", entity="user", entity_id=user.id, metadata=None)
    db.session.commit()
    return jsonify(_issue_full_tokens(user)), 200


@auth_bp.post("/logout")
@jwt_required()
@limiter.limit("30 per minute")
def logout():
    """Invalidate the current access token (and optional refresh token body)."""
    token = get_jwt()
    revoke_jti(token.get("jti"))
    body = request.get_json(silent=True) or {}
    refresh_raw = body.get("refresh_token")
    if isinstance(refresh_raw, str) and refresh_raw:
        try:
            decoded = decode_token(refresh_raw)
            if decoded.get("type") == "refresh":
                revoke_jti(decoded.get("jti"))
        except InvalidTokenError:
            pass
    uid = get_jwt_identity()
    try:
        user_id = int(uid) if uid is not None else None
    except (TypeError, ValueError):
        user_id = None
    write_audit(user_id=user_id, action="logout", entity="user", entity_id=user_id, metadata=None)
    db.session.commit()
    return jsonify({"msg": "logged out"}), 200


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
@limiter.limit("60 per minute")
def refresh():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"msg": "user missing"}), 401
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    access = create_access_token(
        identity=str(user.id),
        additional_claims={"twofa_pending": False, "role": role_val},
        expires_delta=current_app.config["JWT_ACCESS_TOKEN_EXPIRES"],
    )
    return jsonify({"access_token": access}), 200


@auth_bp.post("/two_factor/setup")
@jwt_full
def two_factor_setup():
    claims = get_jwt()
    if claims.get("twofa_pending"):
        return jsonify({"msg": "complete login first"}), 401
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return jsonify({"msg": "not found"}), 404
    secret = pyotp.random_base32()
    user.two_factor_secret = secret
    user.is_two_factor_enabled = False
    write_audit(
        user_id=user.id,
        action="two_factor_setup",
        entity="user",
        entity_id=user.id,
        metadata=None,
    )
    db.session.commit()

    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="PSC Manager")
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return jsonify(
        {
            "secret": secret,
            "otpauth_url": uri,
            "qr_data_url": f"data:image/png;base64,{qr_b64}",
            "message": "Scan in Google Authenticator, then POST /two_factor/enable with a valid code.",
        }
    )


@auth_bp.post("/two_factor/enable")
@jwt_full
def two_factor_enable():
    claims = get_jwt()
    if claims.get("twofa_pending"):
        return jsonify({"msg": "complete login first"}), 401
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None or not user.two_factor_secret:
        return jsonify({"msg": "run setup first"}), 400
    code = (request.get_json(silent=True) or {}).get("code") or ""
    totp = pyotp.TOTP(user.two_factor_secret)
    if not totp.verify(code.replace(" ", ""), valid_window=1):
        return jsonify({"msg": "invalid code"}), 400
    user.is_two_factor_enabled = True
    write_audit(user_id=user.id, action="two_factor_enable", entity="user", entity_id=user.id, metadata=None)
    db.session.commit()
    return jsonify({"msg": "2fa enabled"})


@auth_bp.post("/two_factor/disable")
@jwt_full
def two_factor_disable():
    claims = get_jwt()
    if claims.get("twofa_pending"):
        return jsonify({"msg": "complete login first"}), 401
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return jsonify({"msg": "not found"}), 404
    body = request.get_json(silent=True) or {}
    password = body.get("password") or ""
    code = (body.get("code") or "").replace(" ", "")
    if not user.check_password(password):
        return jsonify({"msg": "bad password"}), 401
    if user.is_two_factor_enabled:
        totp = pyotp.TOTP(user.two_factor_secret)
        if not totp.verify(code, valid_window=1):
            return jsonify({"msg": "invalid code"}), 401
    user.is_two_factor_enabled = False
    user.two_factor_secret = None
    write_audit(user_id=user.id, action="two_factor_disable", entity="user", entity_id=user.id, metadata=None)
    db.session.commit()
    return jsonify({"msg": "2fa disabled"})


@auth_bp.get("/security-profile")
@role_required("USER", "ADMIN")
def security_profile():
    """
    Checklist + vault security summary for the signed-in user.

    Contains **no** decrypted vault passwords — only persisted metadata and account flags.
    """
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"msg": "not found"}), 404

    rows = StoredCredential.query.filter_by(user_id=user_id).order_by(StoredCredential.id).all()
    report = build_security_report(user_id, rows)
    max_age = int(current_app.config.get("PASSWORD_ROTATION_MAX_AGE_DAYS", 180))
    hc = int(report["health_score"])
    totals = report["totals"]

    checklist = [
        {
            "id": "twofa",
            "title": "Enable two-factor authentication",
            "description": "Adds a second step after your password so a stolen password alone is not enough.",
            "done": bool(user.is_two_factor_enabled),
        },
        {
            "id": "vault_health",
            "title": "Raise vault health score",
            "description": "Aim for a score of 70 or higher by fixing weak, reused, stale, or breach-flagged entries.",
            "done": hc >= 70,
        },
        {
            "id": "no_reuse",
            "title": "Eliminate password reuse in the vault",
            "description": "Each reuse cluster means the same secret protects more than one site.",
            "done": int(totals.get("reuse_clusters") or 0) == 0,
        },
        {
            "id": "no_breach_flags",
            "title": "Clear breach flags on vault passwords",
            "description": "Run “Check strength” on entries flagged as appearing in breach corpora.",
            "done": int(totals.get("breached_flags") or 0) == 0,
        },
        {
            "id": "rotate_stale",
            "title": "Rotate stale vault passwords",
            "description": f"Passwords older than {max_age} days should be refreshed.",
            "done": int(totals.get("stale_passwords") or 0) == 0,
        },
        {
            "id": "analyze_all",
            "title": "Analyze every vault entry at least once",
            "description": "Strength metadata improves reporting and reminders.",
            "done": int(totals.get("unanalyzed") or 0) == 0,
        },
    ]

    write_audit(
        user_id=user_id,
        action="security_profile_view",
        entity="user",
        entity_id=user_id,
        metadata={"health_score": hc},
    )
    db.session.commit()

    return jsonify(
        {
            "two_factor_enabled": bool(user.is_two_factor_enabled),
            "password_rotation_max_age_days": max_age,
            "vault_security": report,
            "checklist": checklist,
        }
    )
