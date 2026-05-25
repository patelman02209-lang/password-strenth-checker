"""Optional legacy table for hash-demo analytics; the live ``/hash-demo`` route does not persist hashes."""

from __future__ import annotations

from sqlalchemy import DateTime, ForeignKey, func

from app.extensions import db


class PasswordHashDemo(db.Model):
    __tablename__ = "password_hash_demos"
    __table_args__ = (db.Index("ix_password_hash_demos_user_created", "user_id", "created_at"),)

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    algorithm = db.Column(db.String(32), nullable=False, index=True)
    input_label = db.Column(db.String(128), nullable=False)
    generated_hash = db.Column(db.Text, nullable=False)
    hash_time_ms = db.Column(db.Integer, nullable=False)
    created_at = db.Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    user = db.relationship("User", back_populates="password_hash_demos")
