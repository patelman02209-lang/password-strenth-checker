"""
Environment-driven configuration.

Secrets MUST come from the environment (or a local `.env` loaded before
`Config` is evaluated). We never ship production-ready secret literals in code.
"""
from __future__ import annotations

import os
from datetime import timedelta

from dotenv import load_dotenv

# Load `.env` before any `os.environ.get(...)` runs at class definition time.
load_dotenv()

# -----------------------------------------------------------------------------
# Security-related configuration (all secrets from environment / .env — never
# committed). ``validate_runtime_config`` in the app factory enforces minimum
# entropy for ``SECRET_KEY``, ``JWT_SECRET_KEY``, and ``VAULT_KDF_PEPPER`` when
# not running under TESTING.
# -----------------------------------------------------------------------------
def _split_origins(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [o.strip() for o in raw.split(",") if o.strip()]


class Config:
    """Base configuration loaded from environment variables."""

    # API versioning — single place to change the URL prefix.
    API_PREFIX = os.environ.get("API_PREFIX", "/api/v1")

    TESTING = False

    # Required for signing sessions / cookies (if used) and general crypto.
    SECRET_KEY = os.environ.get("SECRET_KEY")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or os.environ.get("SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.environ.get("JWT_ACCESS_MINUTES", "30")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.environ.get("JWT_REFRESH_DAYS", "7")))
    JWT_ALGORITHM = "HS256"
    JWT_BLOCKLIST_ENABLED = True

    # Stored user password algorithm: ``bcrypt`` (default) or ``argon2id``.
    PASSWORD_HASH_DEFAULT = os.environ.get("PASSWORD_HASH_DEFAULT", "bcrypt").lower()

    # MySQL (or other) — set DATABASE_URI, e.g. mysql+pymysql://user:pass@host:3306/dbname
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URI", "sqlite:///psc_dev.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    CORS_ORIGINS = _split_origins(os.environ.get("CORS_ORIGINS", "http://localhost:5173"))

    # Flask-Limiter storage (use Redis in production for multiple workers).
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    VAULT_KDF_PEPPER = os.environ.get("VAULT_KDF_PEPPER")
    LOCAL_BREACH_FILE = os.environ.get("LOCAL_BREACH_FILE") or None

    # HIBP Pwned Passwords range API (k-anonymity): connect and total read timeouts (seconds).
    HIBP_CONNECT_TIMEOUT = float(os.environ.get("HIBP_CONNECT_TIMEOUT", "3.0"))
    HIBP_TIMEOUT = float(os.environ.get("HIBP_TIMEOUT", "5.0"))

    # Vault UX: flag credentials whose password has not been rotated in this many days.
    PASSWORD_ROTATION_MAX_AGE_DAYS = int(os.environ.get("PASSWORD_ROTATION_MAX_AGE_DAYS", "180"))

    BOOTSTRAP_ADMIN_USERNAME = os.environ.get("BOOTSTRAP_ADMIN_USERNAME")
    BOOTSTRAP_ADMIN_EMAIL = os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "admin@example.com")
    BOOTSTRAP_ADMIN_PASSWORD = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD")

    # Log request bodies only in controlled environments (never in production).
    LOG_REQUEST_BODY = os.environ.get("LOG_REQUEST_BODY", "false").lower() in ("1", "true", "yes")


class ProductionConfig(Config):
    """
    Production-oriented defaults when ``FLASK_ENV=production``.

    Secrets and URLs still come only from the environment (see ``Config``).
    """

    DEBUG = False
    TESTING = False


def get_config_class() -> type[Config]:
    """Resolve config class from ``FLASK_ENV`` (used by ``create_app``)."""
    if os.environ.get("FLASK_ENV", "").lower() == "production":
        return ProductionConfig
    return Config


class TestConfig(Config):
    """Pytest: deterministic secrets and in-memory-friendly settings."""

    TESTING = True
    SECRET_KEY = "test-secret-key-32-chars-minimum-length!!"
    JWT_SECRET_KEY = "test-jwt-secret-key-32-chars-minimum-length!"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    BOOTSTRAP_ADMIN_USERNAME = None
    JWT_ACCESS_TOKEN_EXPIRES = False  # type: ignore[assignment]
    JWT_REFRESH_TOKEN_EXPIRES = False  # type: ignore[assignment]
    VAULT_KDF_PEPPER = "test-vault-pepper-32-characters-minimum!!"
    LOG_REQUEST_BODY = False


def validate_runtime_config(app) -> None:
    """
    Fail fast on insecure or incomplete configuration (except in tests).

    Call from the application factory after loading config.
    """
    if app.config.get("TESTING"):
        return
    sk = app.config.get("SECRET_KEY")
    if not sk or len(sk) < 32:
        raise RuntimeError(
            "SECRET_KEY must be set in the environment to at least 32 characters. "
            "Copy backend/.env.example to backend/.env and generate strong values."
        )
    jsk = app.config.get("JWT_SECRET_KEY")
    if not jsk or len(jsk) < 32:
        raise RuntimeError("JWT_SECRET_KEY must be set (or derive from SECRET_KEY) with length >= 32.")
    if not app.config.get("VAULT_KDF_PEPPER") or len(app.config["VAULT_KDF_PEPPER"]) < 32:
        raise RuntimeError("VAULT_KDF_PEPPER must be set to at least 32 characters for vault key derivation.")
    ph = str(app.config.get("PASSWORD_HASH_DEFAULT", "bcrypt")).lower()
    if ph not in ("bcrypt", "argon2id"):
        raise RuntimeError("PASSWORD_HASH_DEFAULT must be 'bcrypt' or 'argon2id'.")
    if os.environ.get("FLASK_ENV", "").lower() == "production":
        if app.config.get("LOG_REQUEST_BODY"):
            raise RuntimeError("LOG_REQUEST_BODY must be disabled in production (set to false).")
        if not app.config.get("CORS_ORIGINS"):
            raise RuntimeError("CORS_ORIGINS must list at least one allowed browser origin in production.")
