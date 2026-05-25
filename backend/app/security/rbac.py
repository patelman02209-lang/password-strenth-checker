"""RBAC helpers layered on top of Flask-JWT-Extended identities.

Flow:
1. ``verify_jwt_in_request()`` ensures a valid, non-expired JWT signature.
2. **2FA gate**: if claim ``twofa_pending`` is true, the user has only completed
   password auth — vault and other protected resources stay blocked until OTP
   verification mints a full session (see ``auth`` login / ``two_factor/verify``).
3. **RBAC**: ``role_required`` loads the **current** ``User`` row from the DB and
   compares ``role`` to allowed roles — JWT ``role`` claim is not trusted alone
   (admins demoted in DB lose access on next request).

IDOR note: always combine ``get_jwt_identity()`` with resource ownership filters
(e.g. ``StoredCredential.user_id == uid``) in route handlers — never trust ``id``
from the path without ownership checks.
"""
from __future__ import annotations

from functools import wraps
from typing import Callable

from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from app.extensions import db
from app.http_api import api_error
from app.models import User


def jwt_full(fn: Callable) -> Callable:
    """
    Require a JWT that is not in the intermediate `twofa_pending` state.

    After password validation for 2FA users, clients must complete OTP before
    accessing vault or privileged tooling.
    """

    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        if get_jwt().get("twofa_pending"):
            return api_error("two-factor authentication required", 401)
        return fn(*args, **kwargs)

    return wrapper


def role_required(*allowed_roles: str) -> Callable:
    """
    Enforce JWT presence and user role membership.

    `allowed_roles` use enum string values, e.g. ``\"ADMIN\"``.
    """

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            if get_jwt().get("twofa_pending"):
                return api_error("two-factor authentication required", 401)
            uid = get_jwt_identity()
            try:
                user_id = int(uid)
            except (TypeError, ValueError):
                return api_error("invalid subject", 401)
            user = db.session.get(User, user_id)
            if user is None:
                return api_error("user not found", 401)
            role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
            if role_val not in allowed_roles:
                return api_error("forbidden", 403)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
