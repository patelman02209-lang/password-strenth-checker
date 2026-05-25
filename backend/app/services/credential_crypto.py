"""
Authenticated symmetric encryption for stored credential fields (per-user key).

We use **Fernet** (from the ``cryptography`` package): token format is AES-128 in
CBC mode with PKCS7 padding plus an HMAC — an **AEAD-style** authenticated
envelope suitable for opaque blobs at rest. Per-user keys are derived with
**HKDF-SHA256** from ``VAULT_KDF_PEPPER`` (required long secret in the environment)
so ciphertexts are not interchangeable across users or legacy storage domains.

``VAULT_KDF_PEPPER`` must never be committed to source control; it is the root
material from which field keys are derived (not the field ciphertext itself).
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from flask import current_app


def _credential_fernet(user_id: int) -> Fernet:
    pepper = current_app.config["VAULT_KDF_PEPPER"].encode("utf-8")
    salt = hashlib.sha256(f"psc-credential:{user_id}".encode()).digest()
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=b"psc-stored-credential-fernet-v1",
    )
    raw = hkdf.derive(pepper)
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_field(user_id: int, plaintext: str) -> bytes:
    """Encrypt a single UTF-8 string field to a BLOB."""
    return _credential_fernet(user_id).encrypt(plaintext.encode("utf-8"))


def decrypt_field(user_id: int, blob: bytes) -> str:
    try:
        return _credential_fernet(user_id).decrypt(blob).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Credential field could not be decrypted") from exc
