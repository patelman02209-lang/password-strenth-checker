"""Shared Flask extensions (single module avoids circular imports).

- **Limiter**: ``get_remote_address`` keying; per-route limits on auth/password routes.
  Use Redis (``RATELIMIT_STORAGE_URI``) when running multiple Gunicorn/uWSGI workers
  so limits are shared process-wide.
- **JWT**: Access + refresh tokens are bearer tokens; revocation uses JTI blocklist
  (``app.security.token_blocklist``) — see ``create_app`` blocklist loader.
- **CORS**: Initialized in the app factory with an explicit origin allow-list.
"""
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
bcrypt = Bcrypt()
jwt = JWTManager()
cors = CORS()
limiter = Limiter(key_func=get_remote_address, default_limits=[])
