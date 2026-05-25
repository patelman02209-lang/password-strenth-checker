"""Per-user Fernet helpers for vault field encryption."""

import pytest

from app.services.credential_crypto import decrypt_field, encrypt_field


def test_encrypt_decrypt_roundtrip(app):
    with app.app_context():
        uid = 42
        plain = "vault-secret-!@#"
        blob = encrypt_field(uid, plain)
        assert isinstance(blob, bytes)
        assert blob != plain.encode()
        assert decrypt_field(uid, blob) == plain


def test_decrypt_wrong_user_fails(app):
    with app.app_context():
        a = encrypt_field(1, "same-bytes-different-key")
        with pytest.raises(ValueError, match="decrypt"):
            decrypt_field(2, a)
