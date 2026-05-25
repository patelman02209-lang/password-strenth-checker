"""Central JSON helpers for API responses (consistent ``msg`` / field shapes)."""
from __future__ import annotations

from typing import Any

from flask import jsonify


def api_error(msg: str, status: int = 400) -> tuple[Any, int]:
    """Client error or auth failure with a single safe ``msg`` string."""
    return jsonify({"msg": msg}), status


def api_ok(data: dict[str, Any] | None = None, *, status: int = 200, **fields: Any) -> tuple[Any, int]:
    """Success JSON; merges ``data`` with keyword fields (keywords win on collision)."""
    payload: dict[str, Any] = {}
    if data:
        payload.update(data)
    payload.update(fields)
    return jsonify(payload), status
