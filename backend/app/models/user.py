from __future__ import annotations

from sqlalchemy import DateTime, func

from app.extensions import db
from app.models.enums import UserRole, UserStatus
from app.security.passwords import hash_password, verify_password


class User(db.Model):
    """
    Application user.

    Passwords are never stored in plaintext; only bcrypt or Argon2id hashes live
    in `password_hash`, with the active algorithm recorded in `password_hash_algorithm`.
    """

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(80), nullable=False, index=True)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(512), nullable=False)
    password_hash_algorithm = db.Column(db.String(32), nullable=False, default="bcrypt", index=True)
    role = db.Column(
        db.Enum(UserRole, values_callable=lambda x: [e.value for e in x], native_enum=False, length=16),
        nullable=False,
        default=UserRole.USER,
        index=True,
    )
    two_factor_secret = db.Column(db.String(64), nullable=True)
    is_two_factor_enabled = db.Column(db.Boolean, nullable=False, default=False, server_default="0")
    status = db.Column(
        db.Enum(UserStatus, values_callable=lambda x: [e.value for e in x], native_enum=False, length=16),
        nullable=False,
        default=UserStatus.ACTIVE,
        index=True,
    )
    created_at = db.Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = db.Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    password_checks = db.relationship(
        "PasswordCheck",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )
    stored_credentials = db.relationship(
        "StoredCredential",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )
    password_hash_demos = db.relationship(
        "PasswordHashDemo",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )
    audit_logs = db.relationship(
        "AuditLog",
        back_populates="user",
        foreign_keys="AuditLog.user_id",
        lazy="dynamic",
    )

    def set_password(self, password: str) -> None:
        h, algo = hash_password(password)
        self.password_hash = h
        self.password_hash_algorithm = algo

    def check_password(self, password: str) -> bool:
        return verify_password(password, self.password_hash)
