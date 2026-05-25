"""
Privacy helpers for vault rows (no plaintext persistence).

``password_reuse_hmac`` is an HMAC-SHA256 over ``user_id`` + password bytes using
``VAULT_KDF_PEPPER`` as key material. Same password for the same user yields the
same digest; different users or passwords yield unrelated values. This is **not**
a password hash for authentication — only a deterministic equality token for
reuse detection. Never log this column or ship it to clients.
"""
from __future__ import annotations

import hashlib
import hmac

from flask import current_app


def compute_password_reuse_hmac(user_id: int, password: str) -> bytes:
    pepper = current_app.config["VAULT_KDF_PEPPER"]
    if not pepper or len(str(pepper)) < 16:
        raise RuntimeError("VAULT_KDF_PEPPER must be configured for vault privacy helpers")
    key = str(pepper).encode("utf-8")
    msg = b"psc-reuse-v1:" + str(user_id).encode("ascii") + b"\x00" + password.encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).digest()
