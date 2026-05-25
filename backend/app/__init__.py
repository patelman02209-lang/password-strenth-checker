"""
Flask application factory for the Password Strength Checker & Manager API.

Security architecture (high level):
- **Auth**: JWT access + refresh in ``Authorization`` (not browser cookies) → classic
  cross-site request forgery against cookie sessions does not apply; still use strict
  CORS and HTTPS in production.
- **RBAC / 2FA**: ``role_required`` + ``jwt_full`` (blocks ``twofa_pending`` tokens) in
  ``app.security.rbac`` — see route decorators on vault, password, and admin blueprints.
- **Transport**: ``after_request`` sets baseline security headers; pair with TLS
  termination and a stricter CSP on the static SPA host in production.
- **Data layer**: SQLAlchemy ORM only (parameter-bound queries); never concatenate SQL
  with user input.
- **Vault**: Per-user Fernet keys from ``VAULT_KDF_PEPPER``; every fetch scoped by
  ``user_id`` to mitigate IDOR (see ``vault`` routes).
- **Rate limits**: Flask-Limiter on sensitive routes; default storage is in-memory —
  configure ``RATELIMIT_STORAGE_URI`` for multi-worker production.
"""
from __future__ import annotations

import logging
import os

from flask import Flask

from app.config import Config, get_config_class, validate_runtime_config
from app.errors import register_error_handlers
from app.extensions import bcrypt, cors, db, jwt, limiter, migrate
from app.logging_config import register_request_logging
from app.models import User, UserRole, UserStatus
from app.routes.admin import admin_bp
from app.routes.audit import audit_bp
from app.routes.auth import auth_bp
from app.routes.health import health_bp
from app.routes.password import password_bp
from app.routes.vault import vault_bp


def create_app(config_class: type[Config] | None = None) -> Flask:
    """
    Application factory.

    Environment variables are loaded from `.env` when `app.config` is imported
    (see `app.config.load_dotenv` at module import).
    """
    app = Flask(__name__)
    app.config.from_object(config_class or get_config_class())

    if not app.debug and not app.testing:
        logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

    validate_runtime_config(app)

    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    jwt.init_app(app)

    @jwt.token_in_blocklist_loader
    def _jwt_blocklist_check(_jwt_header, jwt_payload):
        from app.security.token_blocklist import is_jti_revoked

        return is_jti_revoked(jwt_payload.get("jti"))

    limiter.init_app(app)

    api_prefix = app.config["API_PREFIX"].rstrip("/")
    # CORS: explicit allow-list only (never "*" with credentials). SPA origin(s) from env.
    cors.init_app(
        app,
        resources={f"{api_prefix}/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )

    register_error_handlers(app)
    register_request_logging(app)

    app.register_blueprint(health_bp, url_prefix=api_prefix)
    app.register_blueprint(auth_bp, url_prefix=f"{api_prefix}/auth")
    app.register_blueprint(password_bp, url_prefix=api_prefix)
    app.register_blueprint(vault_bp, url_prefix=f"{api_prefix}/vault")
    app.register_blueprint(audit_bp, url_prefix=f"{api_prefix}/audit")
    app.register_blueprint(admin_bp, url_prefix=f"{api_prefix}/admin")

    @app.after_request
    def _security_headers(response):
        """
        Baseline browser-oriented protections for API responses.

        CSP is intentionally omitted here because API + SPA split would require
        careful tuning; production deployments should add a strict CSP on the
        static host and separate API headers.

        ``Cache-Control: no-store`` avoids sensitive JSON (tokens, analysis) being
        written to shared disk caches by intermediaries or the browser HTTP cache.
        """
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        response.headers.setdefault("Cache-Control", "no-store, private")
        response.headers.setdefault("Pragma", "no-cache")
        return response

    with app.app_context():
        _bootstrap_database(app)
        _seed_bootstrap_admin(app)

    return app


def _bootstrap_database(app: Flask) -> None:
    """
    Create tables only in the test harness.

    For all other environments (including local SQLite), apply schema with
    ``flask db upgrade`` so changes are versioned in Alembic.
    """
    if app.config.get("TESTING"):
        db.create_all()
        return
    if os.environ.get("AUTO_DB_CREATE_ALL") == "1":
        db.create_all()
        app.logger.warning("AUTO_DB_CREATE_ALL=1: create_all() was used; not recommended for production.")


def _seed_bootstrap_admin(app: Flask) -> None:
    """
    Create the first admin user when the database is empty.

    Skips if the `users` table does not exist yet (before migrations).
    """
    from sqlalchemy import inspect

    if "users" not in inspect(db.engine).get_table_names():
        return

    if User.query.count() > 0:
        return

    if not app.config.get("BOOTSTRAP_ADMIN_USERNAME"):
        return

    u = User(
        name=app.config["BOOTSTRAP_ADMIN_USERNAME"],
        email=app.config["BOOTSTRAP_ADMIN_EMAIL"],
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    u.set_password(app.config["BOOTSTRAP_ADMIN_PASSWORD"])
    db.session.add(u)
    db.session.commit()
