"""
Aggregated vault security metrics for dashboards and exports.

All outputs are derived from **non-secret** columns and titles/URLs already stored
in plaintext on credential rows. Password ciphertext is never decrypted here.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from flask import current_app

from app.models import StoredCredential


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


_STRENGTH_PENALTY = {
    "very_weak": 22,
    "weak": 12,
    "moderate": 6,
    "strong": 0,
    "very_strong": 0,
    "empty": 25,
}


def _max_password_age_days() -> int:
    raw = current_app.config.get("PASSWORD_ROTATION_MAX_AGE_DAYS", 180)
    try:
        return max(30, min(730, int(raw)))
    except (TypeError, ValueError):
        return 180


def reuse_group_sizes(rows: list[StoredCredential]) -> dict[int, int]:
    """Map credential id -> count of credentials sharing the same reuse token (>=1)."""
    by_hmac: dict[bytes, list[int]] = defaultdict(list)
    for r in rows:
        if r.password_reuse_hmac is None:
            continue
        by_hmac[r.password_reuse_hmac].append(r.id)
    out: dict[int, int] = {}
    for ids in by_hmac.values():
        n = len(ids)
        for iid in ids:
            out[iid] = n
    return out


def compute_health_score(
    *,
    total: int,
    weak_labels: list[str | None],
    breach_count: int,
    stale_count: int,
    reuse_pair_count: int,
) -> int:
    """Heuristic 0–100 score (higher is better). No password material involved."""
    if total <= 0:
        return 100
    score = 100.0
    for lab in weak_labels:
        k = (lab or "").strip().lower() or "unknown"
        score -= _STRENGTH_PENALTY.get(k, 8)
    score -= min(40, breach_count * 12)
    score -= min(30, stale_count * 8)
    score -= min(35, reuse_pair_count * 10)
    return int(max(0, min(100, round(score))))


def build_security_report(user_id: int, rows: list[StoredCredential]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    max_age_days = _max_password_age_days()
    group_size_by_id = reuse_group_sizes(rows)

    weak = 0
    unanalyzed = 0
    breached = 0
    stale = 0
    reuse_clusters: list[dict[str, Any]] = []
    labels: list[str | None] = []

    hmac_to_titles: dict[bytes, list[str]] = defaultdict(list)
    for r in rows:
        labels.append(r.strength_label)
        lab = (r.strength_label or "").lower()
        if not r.strength_label:
            unanalyzed += 1
        elif lab in ("very_weak", "weak"):
            weak += 1
        if r.is_breached:
            breached += 1
        ref = _as_utc(r.password_set_at) or _as_utc(r.created_at)
        if ref is not None:
            age = (now - ref).days
            if age > max_age_days:
                stale += 1
        if r.password_reuse_hmac is not None:
            hmac_to_titles[r.password_reuse_hmac].append(r.title[:200])

    for _h, titles in hmac_to_titles.items():
        if len(titles) > 1:
            reuse_clusters.append({"size": len(titles), "titles": titles[:20]})

    reuse_pair_count = sum(max(0, c["size"] - 1) for c in reuse_clusters)
    health = compute_health_score(
        total=len(rows),
        weak_labels=labels,
        breach_count=breached,
        stale_count=stale,
        reuse_pair_count=reuse_pair_count,
    )

    items_summary: list[dict[str, Any]] = []
    for r in rows:
        gid = group_size_by_id.get(r.id, 1)
        ref = _as_utc(r.password_set_at) or _as_utc(r.created_at)
        age_days = (now - ref).days if ref else None
        items_summary.append(
            {
                "id": r.id,
                "title": r.title,
                "website_url": r.website_url,
                "strength_label": r.strength_label,
                "entropy_bits": r.entropy_bits,
                "complexity_score": r.complexity_score,
                "is_breached": bool(r.is_breached),
                "last_checked_at": r.last_checked_at.isoformat() if r.last_checked_at else None,
                "password_set_at": r.password_set_at.isoformat() if r.password_set_at else None,
                "password_age_days": age_days,
                "password_stale": bool(ref and age_days is not None and age_days > max_age_days),
                "password_reuse_group_size": gid,
                "password_reuse_warning": gid > 1,
            }
        )

    return {
        "generated_at": now.isoformat(),
        "password_rotation_max_age_days": max_age_days,
        "health_score": health,
        "totals": {
            "credentials": len(rows),
            "weak": weak,
            "unanalyzed": unanalyzed,
            "breached_flags": breached,
            "stale_passwords": stale,
            "reuse_clusters": len(reuse_clusters),
        },
        "reuse_clusters": reuse_clusters,
        "items": items_summary,
    }
