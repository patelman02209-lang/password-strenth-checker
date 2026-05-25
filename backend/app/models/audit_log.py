"""Append-only security / activity audit trail."""

from __future__ import annotations

from sqlalchemy import DateTime, ForeignKey, func

from app.extensions import db


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    __table_args__ = (
        db.Index("ix_audit_logs_user_created", "user_id", "created_at"),
        db.Index("ix_audit_logs_entity", "entity", "entity_id"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = db.Column(db.String(64), nullable=False, index=True)
    entity = db.Column(db.String(64), nullable=False)
    entity_id = db.Column(db.Integer, nullable=True, index=True)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.Text, nullable=True)
    # SQLAlchemy reserves `metadata` on Declarative API — DB column `audit_metadata`.
    audit_metadata = db.Column("audit_metadata", db.JSON, nullable=True)
    created_at = db.Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    user = db.relationship("User", back_populates="audit_logs", foreign_keys=[user_id])
