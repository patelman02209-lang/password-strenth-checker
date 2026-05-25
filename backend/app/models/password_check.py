"""
Historical password *analysis* rows — never stores the evaluated password.

Only derived metrics and labels are persisted for auditing and UX history.
"""
from __future__ import annotations

from sqlalchemy import DateTime, ForeignKey, func

from app.extensions import db


class PasswordCheck(db.Model):
    __tablename__ = "password_checks"
    __table_args__ = (
        db.Index("ix_password_checks_user_created", "user_id", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    entropy_score = db.Column(db.Float, nullable=False)
    complexity_score = db.Column(db.Integer, nullable=False)
    strength_label = db.Column(db.String(64), nullable=False)
    is_common_password = db.Column(db.Boolean, nullable=False, default=False, server_default="0")
    is_breached = db.Column(db.Boolean, nullable=False, default=False, server_default="0")
    breach_count = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    detected_patterns = db.Column(db.JSON, nullable=True)
    suggestions = db.Column(db.JSON, nullable=True)
    crack_time_estimate = db.Column(db.JSON, nullable=True)
    created_at = db.Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    user = db.relationship("User", back_populates="password_checks")
