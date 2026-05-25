"""Persist password analysis results (never the password string)."""
from __future__ import annotations

from typing import Any

from app.extensions import db
from app.models.password_check import PasswordCheck
from app.services.crack_time import estimate_crack_seconds
from app.services.password_analyzer import AnalysisResult


def record_password_check(
    user_id: int,
    result: AnalysisResult,
    *,
    is_breached: bool = False,
    breach_count: int = 0,
) -> PasswordCheck:
    crack = estimate_crack_seconds(result.entropy_bits)
    row = PasswordCheck(
        user_id=user_id,
        entropy_score=float(result.entropy_bits),
        complexity_score=int(result.complexity_score),
        strength_label=result.strength_label[:64],
        is_common_password=bool(result.is_common),
        is_breached=is_breached,
        breach_count=int(breach_count),
        detected_patterns=list(result.patterns),
        suggestions=list(result.suggestions),
        crack_time_estimate=_json_safe(crack),
    )
    db.session.add(row)
    return row


def _json_safe(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, float) and (obj != obj or obj in (float("inf"), float("-inf"))):
        return None
    return obj
