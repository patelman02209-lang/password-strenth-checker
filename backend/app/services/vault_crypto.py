"""
Per-user vault encryption using HKDF + Fernet.

This is a **deliberately simplified demo model** suitable for coursework:
- Keys are reproducible server-side from `VAULT_KDF_PEPPER` + user id.
- Anyone with DB + pepper can decrypt vault rows.

Production systems typically use a user-held master password, HSM/KMS, or
client-side encryption so the server never has sufficient material alone.
"""
from __future__ import annotations

import base64
import hashlib
from typing import TYPE_CHECKING

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from flask import current_app

if TYPE_CHECKING:
    from app.models.user import User


def _user_fernet(user_id: int) -> Fernet:
    pepper = current_app.config["VAULT_KDF_PEPPER"].encode("utf-8")
    salt = hashlib.sha256(f"psc-vault:{user_id}".encode()).digest()
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=b"psc-vault-fernet-key-v1",
    )
    raw = hkdf.derive(pepper)
    key = base64.urlsafe_b64encode(raw)
    return Fernet(key)


def encrypt_for_user(user_id: int, plaintext: str) -> bytes:
    return _user_fernet(user_id).encrypt(plaintext.encode("utf-8"))


def decrypt_for_user(user_id: int, token: bytes) -> str:
    try:
        return _user_fernet(user_id).decrypt(token).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Vault ciphertext could not be decrypted") from exc
