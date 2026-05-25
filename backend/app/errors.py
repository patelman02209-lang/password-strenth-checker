"""Central API error handlers — safe messages, structured JSON.

Design:
- **No stack traces or driver errors** to clients in production (``debug=False``).
- **SQLAlchemyError** → generic message; full traceback only in server logs.
- **RateLimitExceeded** → constant message (do not leak limiter internals).
"""
from __future__ import annotations

from flask import Flask, jsonify, request
from flask_limiter.errors import RateLimitExceeded
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException


def register_error_handlers(app: Flask) -> None:
    """Register handlers in order from more specific to generic."""

    @app.errorhandler(RateLimitExceeded)
    def _rate_limit(_e: RateLimitExceeded):
        return jsonify({"msg": "Too many requests; please try again later."}), 429

    @app.errorhandler(SQLAlchemyError)
    def _database_error(_e: SQLAlchemyError):
        # Never expose driver-specific errors to clients.
        app.logger.exception("database_error path=%s", request.path)
        return jsonify({"msg": "A data service error occurred."}), 500

    @app.errorhandler(HTTPException)
    def _http_exception(e: HTTPException):
        # Use Werkzeug's safe description; avoid echoing raw exception strings.
        body = {"msg": e.description or "request error", "code": e.code}
        return jsonify(body), e.code

    @app.errorhandler(Exception)
    def _unhandled_exception(e: Exception):
        # In debug mode, surface the message to help developers only.
        app.logger.exception("unhandled_exception path=%s", request.path)
        if app.debug:
            return jsonify({"msg": "internal error", "detail": str(e)}), 500
        return jsonify({"msg": "An unexpected error occurred."}), 500
