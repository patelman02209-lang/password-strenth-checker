"""Liveness/readiness style health checks (unauthenticated, rate-limit exempt)."""
from __future__ import annotations

from flask import Blueprint, jsonify
from sqlalchemy import text

from app.extensions import db, limiter

health_bp = Blueprint("health", __name__)


@limiter.exempt
@health_bp.get("/health")
def health():
    """Process is up. Does not verify downstream services (add checks if needed)."""
    return jsonify({"status": "ok", "api_version": "v1"}), 200


@limiter.exempt
@health_bp.get("/health/ready")
def ready():
    """Lightweight DB connectivity check for orchestrators."""
    try:
        db.session.execute(text("SELECT 1"))
    except Exception:
        return jsonify({"status": "not_ready", "reason": "database"}), 503
    return jsonify({"status": "ready"}), 200
