"""Request/response logging for observability (no sensitive body logging by default)."""
from __future__ import annotations

import time
from typing import TYPE_CHECKING

from flask import Flask, g, has_request_context, request

if TYPE_CHECKING:
    from werkzeug.wrappers import Response


def register_request_logging(app: Flask) -> None:
    """
    Log method, path, status, and duration.

    Request bodies are NOT logged unless LOG_REQUEST_BODY is enabled (dev only).

    Never enable body logging in production: JSON routes such as ``/analyze``,
    ``/strength``, ``/hibp``, ``/vault/items``, and ``/hash-demo`` accept passwords.
    """

    @app.before_request
    def _request_start() -> None:
        g._psc_req_start = time.perf_counter()

    @app.after_request
    def _request_log(response: Response) -> Response:
        if not has_request_context():
            return response
        start = getattr(g, "_psc_req_start", None)
        elapsed_ms = int((time.perf_counter() - start) * 1000) if start is not None else -1
        line = "%s %s -> %s %sms" % (request.method, request.path, response.status_code, elapsed_ms)
        if app.config.get("LOG_REQUEST_BODY") and request.method in ("POST", "PUT", "PATCH"):
            # Never enable in production — passwords appear in JSON bodies.
            ct = (request.content_type or "").lower()
            if "json" in ct:
                line += " body_len=%s" % (request.content_length or 0)
        app.logger.info(line)
        return response
