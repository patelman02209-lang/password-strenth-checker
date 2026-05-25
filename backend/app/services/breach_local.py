"""
Local breach file checking (SHA-1 lines compatible with HIBP / downloader output).

Supports:
- Bare ``HASH`` (40 hex uppercase) — treat as found with count ``1`` if matched.
- ``HASH:count`` as emitted by many leak tools and compatible with HIBP corpus layout.

For very large files, prefer sorted corpora with prefix indexing or an external DB;
this module performs a linear scan suitable for coursework and modest lists.
"""
from __future__ import annotations

import hashlib
from pathlib import Path


def sha1_line(password: str) -> str:
    # SHA-1 is required by the HIBP range API and hash list interchange format, not for TLS.
    return hashlib.sha1(password.encode("utf-8"), usedforsecurity=False).hexdigest().upper()


def check_local_file(password: str, file_path: str | None, max_scan_lines: int = 2_000_000) -> dict:
    """
    Linear scan of a local hash file.

    ``file_path`` should point to a text file with one SHA-1 hash per line (optionally
    ``HASH:occurrence_count``), as produced by tools such as **haveibeenpwned-downloader**
    or similar HIBP hash list exports.
    """
    if not file_path:
        return {"enabled": False, "found": False, "breach_count": 0, "reason": "LOCAL_BREACH_FILE not configured"}
    path = Path(file_path)
    if not path.is_file():
        return {"enabled": True, "found": False, "breach_count": 0, "reason": f"file_missing:{path}"}

    target = sha1_line(password)
    lines = 0
    with path.open("r", encoding="utf-8", errors="ignore") as fh:
        for raw in fh:
            lines += 1
            if lines > max_scan_lines:
                return {
                    "enabled": True,
                    "found": False,
                    "breach_count": 0,
                    "truncated": True,
                    "reason": "scan_limit_reached",
                    "lines_scanned": lines,
                }
            h = raw.strip().upper()
            if not h or h.startswith("#"):
                continue
            count = 1
            if ":" in h:
                h_part, _, rest = h.partition(":")
                h = h_part.strip()
                try:
                    count = max(1, int(rest.strip().split()[0]))
                except (ValueError, IndexError):
                    count = 1
            if not h:
                continue
            if h == target:
                return {"enabled": True, "found": True, "breach_count": count, "lines_scanned": lines}
    return {"enabled": True, "found": False, "breach_count": 0, "lines_scanned": lines}
