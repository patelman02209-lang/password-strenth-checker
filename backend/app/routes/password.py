"""
Password intelligence API (analysis, generation, breach checks, hash demo).

Security:
- All persistence uses SQLAlchemy models with bound parameters (no raw SQL strings).
- Password strings exist only in request memory for the lifetime of the handler;
  ``record_password_check`` stores **metadata** only (see ``PasswordCheck`` model).
- Breach checks use **HIBP k-anonymity** (5-hex prefix over TLS) via ``hibp`` service.
"""
from __future__ import annotations

from dataclasses import asdict

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity

from app.extensions import db, limiter
from app.http_api import api_error
from app.models import PasswordCheck
from app.security.rbac import role_required
from app.services.audit_service import write_audit
from app.services.breach_check import check_password_breach
from app.services.breach_local import check_local_file
from app.services.crack_time import estimate_crack_seconds
from app.services.generator import (
    generate_passphrase,
    generate_passphrase_batch,
    generate_password,
    generate_password_batch,
)
from app.services.hashing import demo_hash_password
from app.services.password_analyzer import analyze_password
from app.services.password_check_store import record_password_check
from app.utils.validation import validate_password_check_input

password_bp = Blueprint("password", __name__)

_STRENGTH_ORDER = {
    "empty": 0,
    "very_weak": 1,
    "weak": 2,
    "moderate": 3,
    "strong": 4,
    "very_strong": 5,
}


def _constraint_suggestions(body: dict, result) -> list[str]:
    """Hints when user-chosen flags produce a relatively weak output (no password text)."""
    out: list[str] = []
    mode = (body.get("mode") or "random").strip().lower()
    if mode == "random":
        ln = int(body.get("length", 20) or 20)
        if ln < 14:
            out.append("Try length ≥ 14 (or use passphrase mode) for stronger offline-cracking margins.")
        if not body.get("use_digits", True) or not body.get("use_symbols", True):
            out.append("Enabling digits and symbols widens the alphabet when you do not need a memorized phrase.")
        if body.get("avoid_ambiguous"):
            out.append("Skipping ambiguous glyphs shrinks the pool slightly — add length to compensate.")
    if mode == "passphrase":
        wc = int(body.get("word_count", 6) or 6)
        if wc < 5:
            out.append("Five or more random words typically outperform short random secrets for memorability.")
    if result.strength_label in ("very_weak", "weak", "moderate"):
        for s in result.suggestions:
            if s and s not in out:
                out.append(s)
    return out[:12]


def _weakest_label(labels: list[str]) -> str:
    return min(labels, key=lambda x: _STRENGTH_ORDER.get(x, 0))


def _execute_password_strength_pipeline(user_id: int, password: str) -> dict:
    """Run analyzer + breach check, persist metadata only, audit, commit."""
    result = analyze_password(password)
    crack = estimate_crack_seconds(result.entropy_bits)

    timeout = (
        float(current_app.config["HIBP_CONNECT_TIMEOUT"]),
        float(current_app.config["HIBP_TIMEOUT"]),
    )
    breach = check_password_breach(
        password,
        local_file_path=current_app.config.get("LOCAL_BREACH_FILE"),
        timeout=timeout,
    )
    is_breached = breach.found
    count = max(0, breach.breach_count)
    row = record_password_check(
        user_id,
        result,
        is_breached=is_breached,
        breach_count=count,
    )
    db.session.flush()
    write_audit(
        user_id=user_id,
        action="password_check",
        entity="password_check",
        entity_id=row.id,
        metadata={"strength_label": result.strength_label},
    )
    db.session.commit()

    return {
        "entropy_bits": result.entropy_bits,
        "complexity_score": result.complexity_score,
        "strength_label": result.strength_label,
        "is_common": result.is_common,
        "patterns": result.patterns,
        "suggestions": result.suggestions,
        "charset_size": result.charset_size,
        "crack_estimate": crack,
        "is_breached": is_breached,
        "breach_count": count,
        "breach_source": breach.source,
        "hibp_ok": breach.hibp_ok,
        "hibp_error": breach.hibp_error,
        "local_breach_checked": breach.local_checked,
    }


def _analyze_or_strength_response():
    data = request.get_json(silent=True) or {}
    password, verr = validate_password_check_input(data.get("password"))
    if verr:
        return api_error(verr)
    uid = int(get_jwt_identity())
    return jsonify(_execute_password_strength_pipeline(uid, password))


@password_bp.post("/analyze")
@limiter.limit("30 per minute")
@role_required("USER", "ADMIN")
def analyze():
    return _analyze_or_strength_response()


@password_bp.post("/strength")
@limiter.limit("30 per minute")
@role_required("USER", "ADMIN")
def strength():
    """Alias for ``POST /analyze`` (password strength + breach metadata)."""
    return _analyze_or_strength_response()


@password_bp.get("/password/history")
@role_required("USER", "ADMIN")
def password_check_history():
    """Own password security history (metadata only; never stores tested passwords)."""
    uid = int(get_jwt_identity())
    try:
        page = max(1, int(request.args.get("page", 1)))
        per = min(100, max(1, int(request.args.get("per_page", 20))))
    except (TypeError, ValueError):
        return api_error("page and per_page must be integers", 400)
    q = PasswordCheck.query.filter_by(user_id=uid).order_by(PasswordCheck.created_at.desc())
    total = q.count()
    rows = q.offset((page - 1) * per).limit(per).all()
    out = []
    for r in rows:
        out.append(
            {
                "id": r.id,
                "entropy_score": r.entropy_score,
                "complexity_score": r.complexity_score,
                "strength_label": r.strength_label,
                "is_common_password": r.is_common_password,
                "is_breached": r.is_breached,
                "breach_count": r.breach_count,
                "detected_patterns": r.detected_patterns,
                "suggestions": r.suggestions,
                "crack_time_estimate": r.crack_time_estimate,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
        )
    return jsonify({"items": out, "page": page, "per_page": per, "total": total})


@password_bp.post("/generate")
@role_required("USER", "ADMIN")
def gen():
    """
    Generate random passwords or memorable passphrases.

    Does not persist secrets. Audits only non-sensitive parameters (mode, counts,
    character flags — never the generated string).
    """
    raw = request.get_json(silent=True)
    if raw is not None and not isinstance(raw, dict):
        return api_error("expected a JSON object", 400)
    data = raw or {}
    mode = (data.get("mode") or "random").strip().lower()
    count = min(10, max(1, int(data.get("count", 1))))
    avoid_ambiguous = bool(data.get("avoid_ambiguous", False))

    passwords: list[str] = []
    try:
        if mode == "passphrase":
            wc = int(data.get("word_count", 6))
            sep = data.get("separator", "-")
            if not isinstance(sep, str) or not sep.strip():
                sep = "-"
            cap = bool(data.get("capitalize_words", False))
            if count == 1:
                passwords = [generate_passphrase(wc, sep, capitalize_words=cap)]
            else:
                passwords = generate_passphrase_batch(
                    count,
                    word_count=wc,
                    separator=sep,
                    capitalize_words=cap,
                )
        elif mode == "random":
            length = int(data.get("length", 20))
            use_upper = bool(data.get("use_upper", True))
            use_lower = bool(data.get("use_lower", True))
            use_digits = bool(data.get("use_digits", True))
            use_symbols = bool(data.get("use_symbols", True))
            if count == 1:
                passwords = [
                    generate_password(
                        length,
                        use_upper=use_upper,
                        use_lower=use_lower,
                        use_digits=use_digits,
                        use_symbols=use_symbols,
                        avoid_ambiguous=avoid_ambiguous,
                    )
                ]
            else:
                passwords = generate_password_batch(
                    count,
                    length=length,
                    use_upper=use_upper,
                    use_lower=use_lower,
                    use_digits=use_digits,
                    use_symbols=use_symbols,
                    avoid_ambiguous=avoid_ambiguous,
                )
        else:
            return api_error("mode must be 'random' or 'passphrase'", 400)
    except ValueError as exc:
        return api_error(str(exc), 400)

    options: list[dict] = []
    labels: list[str] = []
    for pw in passwords:
        result = analyze_password(pw)
        crack = estimate_crack_seconds(result.entropy_bits)
        labels.append(result.strength_label)
        c_sug = _constraint_suggestions(data, result)
        options.append(
            {
                "password": pw,
                "analysis": asdict(result),
                "crack_estimate": crack,
                "constraint_suggestions": c_sug,
            }
        )

    uid = int(get_jwt_identity())
    meta: dict = {
        "mode": mode,
        "count": count,
        "avoid_ambiguous": avoid_ambiguous,
        "weakest_strength_label": _weakest_label(labels),
    }
    if mode == "random":
        meta["length"] = int(data.get("length", 20))
        meta["classes"] = {
            "upper": bool(data.get("use_upper", True)),
            "lower": bool(data.get("use_lower", True)),
            "digits": bool(data.get("use_digits", True)),
            "symbols": bool(data.get("use_symbols", True)),
        }
    else:
        meta["word_count"] = int(data.get("word_count", 6))
        meta["passphrase_capitalize"] = bool(data.get("capitalize_words", False))

    write_audit(
        user_id=uid,
        action="password_generate",
        entity="user",
        entity_id=uid,
        metadata=meta,
    )
    db.session.commit()

    payload: dict = {"mode": mode, "count": count, "options": options}
    if count == 1:
        payload["password"] = options[0]["password"]
        payload["analysis"] = options[0]["analysis"]
        payload["crack_estimate"] = options[0]["crack_estimate"]
        payload["constraint_suggestions"] = options[0]["constraint_suggestions"]
    return jsonify(payload)


@password_bp.post("/hibp")
@limiter.limit("30 per minute")
@role_required("USER", "ADMIN")
def hibp():
    data = request.get_json(silent=True) or {}
    password, verr = validate_password_check_input(data.get("password"))
    if verr:
        return api_error(verr)
    timeout = (
        float(current_app.config["HIBP_CONNECT_TIMEOUT"]),
        float(current_app.config["HIBP_TIMEOUT"]),
    )
    breach = check_password_breach(
        password,
        local_file_path=current_app.config.get("LOCAL_BREACH_FILE"),
        timeout=timeout,
    )
    # Legacy field: ``-1`` when neither HIBP nor local list could confirm exposure.
    pwned_count = breach.breach_count if (breach.hibp_ok or breach.local_found) else -1
    return jsonify(
        {
            "found": breach.found,
            "breach_count": breach.breach_count,
            "pwned_count": pwned_count,
            "source": breach.source,
            "hibp_ok": breach.hibp_ok,
            "hibp_error": breach.hibp_error,
            "local_checked": breach.local_checked,
            "local_found": breach.local_found,
            "note": "SHA-1 prefix only is sent to HIBP; plaintext never leaves your trust boundary.",
        }
    )


@password_bp.post("/local-breach")
@limiter.limit("30 per minute")
@role_required("USER", "ADMIN")
def local_breach():
    data = request.get_json(silent=True) or {}
    password, verr = validate_password_check_input(data.get("password"))
    if verr:
        return api_error(verr)
    path = current_app.config.get("LOCAL_BREACH_FILE")
    return jsonify(check_local_file(password, path))


@password_bp.post("/hash-demo")
@limiter.limit("30 per minute")
@role_required("USER", "ADMIN")
def hash_demo():
    """
    Authenticated teaching endpoint: bcrypt + Argon2id hashes and timings in the response only.

    The sample password is never stored. Generated hash strings are not persisted — only non-sensitive
    audit metadata (algorithms and millisecond timings) is committed.
    """
    data = request.get_json(silent=True) or {}
    password, verr = validate_password_check_input(data.get("password"))
    if verr:
        return api_error(verr)
    user_id = int(get_jwt_identity())
    out = demo_hash_password(password)
    write_audit(
        user_id=user_id,
        action="hash_demo",
        entity="password_hash_demo",
        entity_id=None,
        metadata={
            "algorithms": ["bcrypt", "argon2id"],
            "bcrypt_hash_time_ms": out["bcrypt_hash_time_ms"],
            "argon2_hash_time_ms": out["argon2_hash_time_ms"],
        },
    )
    db.session.commit()
    return jsonify(out)


@password_bp.post("/crack-estimate")
@role_required("USER", "ADMIN")
def crack_only():
    raw = request.get_json(silent=True)
    if raw is not None and not isinstance(raw, dict):
        return api_error("expected a JSON object", 400)
    data = raw or {}
    try:
        entropy = float(data.get("entropy_bits", 0))
    except (TypeError, ValueError):
        return api_error("entropy_bits number required", 400)
    try:
        gps = float(data.get("guesses_per_second", 10e9))
    except (TypeError, ValueError):
        return api_error("guesses_per_second must be a number", 400)
    return jsonify(estimate_crack_seconds(entropy, guesses_per_second=gps))
