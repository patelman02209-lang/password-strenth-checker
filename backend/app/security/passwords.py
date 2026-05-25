"""
Password hashing for stored user passwords.

**Default: bcrypt** (via Flask-Bcrypt). Optional **Argon2id** when
``PASSWORD_HASH_DEFAULT=argon2id`` is set in the environment / Flask config.

Verification inspects the hash prefix so Argon2 and bcrypt remain compatible
with mixed rows after algorithm changes.
"""
from __future__ import annotations

import os

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from flask_bcrypt import check_password_hash

from app.extensions import bcrypt

_ph = PasswordHasher()


def _preferred_algorithm() -> str:
    try:
        from flask import current_app, has_app_context

        if has_app_context():
            raw = current_app.config.get("PASSWORD_HASH_DEFAULT", "bcrypt")
            return str(raw).lower()
    except Exception:
        pass
    return os.environ.get("PASSWORD_HASH_DEFAULT", "bcrypt").lower()


def hash_password(plain: str, algorithm: str | None = None) -> tuple[str, str]:
    """
    Hash ``plain`` and return ``(hash_string, algorithm_label)``.

    ``algorithm`` may be ``\"bcrypt\"`` or ``\"argon2id\"``; when omitted the
    active Flask config / environment default is used.
    """
    algo = (algorithm or _preferred_algorithm()).lower()
    if algo == "argon2id":
        return _ph.hash(plain), "argon2id"
    if algo != "bcrypt":
        raise ValueError(f"unsupported PASSWORD_HASH_DEFAULT: {algo!r} (use bcrypt or argon2id)")
    raw = bcrypt.generate_password_hash(plain)
    if isinstance(raw, bytes):
        return raw.decode("utf-8"), "bcrypt"
    return str(raw), "bcrypt"


def verify_password(plain: str, stored_hash: str) -> bool:
    """
    Verify a password against a stored hash.

    Detects Argon2 vs bcrypt from the hash prefix.
    """
    if stored_hash.startswith("$argon2"):
        try:
            _ph.verify(stored_hash, plain)
            return True
        except VerifyMismatchError:
            return False
    return check_password_hash(stored_hash, plain)
