"""
User credential rows with sensitive fields stored as ciphertext (BLOB).

Plaintext usernames/passwords/notes exist only transiently in memory during
request handling; persistence uses Fernet blobs derived per-user (see
`app.services.credential_crypto`).
"""
from __future__ import annotations

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, func

from app.extensions import db


class StoredCredential(db.Model):
    __tablename__ = "stored_credentials"
    __table_args__ = (db.Index("ix_stored_credentials_user_title", "user_id", "title"),)

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    username_encrypted = db.Column(db.LargeBinary, nullable=False)
    password_encrypted = db.Column(db.LargeBinary, nullable=False)
    website_url = db.Column(db.String(512), nullable=True)
    notes_encrypted = db.Column(db.LargeBinary, nullable=True)
    strength_label = db.Column(db.String(64), nullable=True)
    last_checked_at = db.Column(DateTime(timezone=True), nullable=True)
    # Metadata only — never plaintext passwords. ``password_reuse_hmac`` is for
    # same-user duplicate detection; do not expose in API responses or logs.
    entropy_bits = db.Column(Float, nullable=True)
    complexity_score = db.Column(Integer, nullable=True)
    is_breached = db.Column(Boolean, nullable=False, default=False, server_default="0")
    password_reuse_hmac = db.Column(LargeBinary(32), nullable=True, index=True)
    password_set_at = db.Column(DateTime(timezone=True), nullable=True)
    created_at = db.Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = db.relationship("User", back_populates="stored_credentials")
