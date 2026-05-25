"""Demonstration helpers for bcrypt and Argon2 (never log or persist plaintext passwords)."""
from __future__ import annotations

import time
from typing import Any

from argon2 import PasswordHasher
from flask_bcrypt import generate_password_hash

_ph = PasswordHasher()

# Assessment-oriented copy: defines terms, contrasts algorithms, states security properties.
HASH_DEMO_EDUCATION: dict[str, Any] = {
    "summary": (
        "This demo computes slow, salted, one-way password hashes. The sample password exists only "
        "in memory for the duration of the request; it is not written to the database."
    ),
    "one_way": (
        "A cryptographic hash used for passwords should be one-way (preimage-resistant): given only "
        "the stored string, an attacker should not be able to recover the original password except by guessing "
        "(e.g. dictionary or brute-force). That is different from encryption, which is reversible with a key."
    ),
    "salt": (
        "A salt is random data mixed into the hash so that two users with the same password get different "
        "stored values. It defeats precomputed rainbow tables and forces attackers to attack each hash "
        "individually. In bcrypt and Argon2, the salt is embedded in the encoded hash string you see below."
    ),
    "work_factor": (
        "bcrypt exposes a cost parameter (log₂ rounds): higher cost means more CPU work per guess, "
        "which slows offline cracking if the hash database leaks. Argon2 tunes memory (m), time (t), "
        "and parallelism (p) so defenders can raise the cost for both CPU and RAM, which helps against "
        "attackers with GPUs or ASICs."
    ),
    "never_plaintext": (
        "Passwords must never be stored in plaintext in a database or log file. Anyone with a copy of the "
        "data — insider, stolen backup, or SQL injection — can read every credential immediately and reuse "
        "them elsewhere. Even encrypted password columns are risky if keys are co-located; slow salted hashes "
        "let you verify logins without ever needing to recover the original secret."
    ),
    "comparison": [
        {
            "aspect": "Design era and focus",
            "bcrypt": "Classic adaptive hash; strong CPU cost; fixed 72-byte input limit.",
            "argon2id": "PHC winner (2015); hybrid Argon2i/d resistance; explicit memory hardness.",
        },
        {
            "aspect": "Tuning",
            "bcrypt": "Main knob: cost factor (e.g. 12 means 2^12 iterations of the core function).",
            "argon2id": "Knobs: memory KiB, iterations, lanes — tune to target verification latency.",
        },
        {
            "aspect": "When to prefer",
            "bcrypt": "Ubiquitous, well-understood; fine default when libraries already integrate it.",
            "argon2id": "Often recommended for new systems when a modern memory-hard KDF is available.",
        },
    ],
    "assessment_prompts": [
        "Explain why storing `SHA256(password)` without a salt and without slowness is unsuitable for passwords.",
        "Describe the threat model: what attacker gains if the user table leaks but only password hashes are taken?",
        "Argue why increasing work factor/memory delays an offline attacker but does not help if the password is in a breach list.",
    ],
}


def _extract_bcrypt_metadata(encoded: str) -> dict[str, Any]:
    meta: dict[str, Any] = {"output_char_length": len(encoded)}
    parts = encoded.split("$")
    if len(parts) >= 3 and parts[1] in ("2a", "2b", "2y"):
        try:
            meta["cost"] = int(parts[2])
        except ValueError:
            meta["cost"] = None
        meta["variant"] = parts[1]
    return meta


def _extract_argon2_metadata(encoded: str) -> dict[str, Any]:
    meta: dict[str, Any] = {"output_char_length": len(encoded)}
    parts = encoded.split("$")
    if len(parts) > 1 and parts[1].startswith("argon2"):
        meta["variant"] = parts[1]
    if len(parts) > 3:
        for segment in parts[3].split(","):
            if "=" not in segment:
                continue
            key, _, val = segment.partition("=")
            key = key.strip()
            if key == "m" and val.isdigit():
                meta["memory_kib"] = int(val)
            elif key == "t" and val.isdigit():
                meta["iterations"] = int(val)
            elif key == "p" and val.isdigit():
                meta["parallelism"] = int(val)
    return meta


def demo_hash_password(password: str) -> dict[str, Any]:
    """
    Return bcrypt and Argon2id hashes plus timings and educational metadata.

    Wall-clock times are in milliseconds (two decimal places). The plaintext password
    must never be returned or persisted by callers.
    """
    t0 = time.perf_counter()
    bcrypt_hash = generate_password_hash(password).decode("utf-8")
    bcrypt_ms = round((time.perf_counter() - t0) * 1000, 2)

    t1 = time.perf_counter()
    argon2_hash = _ph.hash(password)
    argon2_ms = round((time.perf_counter() - t1) * 1000, 2)

    return {
        "bcrypt": bcrypt_hash,
        "argon2id": argon2_hash,
        "bcrypt_hash_time_ms": bcrypt_ms,
        "argon2_hash_time_ms": argon2_ms,
        "bcrypt_metadata": _extract_bcrypt_metadata(bcrypt_hash),
        "argon2_metadata": _extract_argon2_metadata(argon2_hash),
        "education": HASH_DEMO_EDUCATION,
        "notes": (
            "Demonstration only: use HTTPS in production. This API does not store your password or these "
            "hashes in the database (audit logs record algorithm names and timings only)."
        ),
    }


def verify_argon2(password: str, argon2_hash: str) -> bool:
    try:
        _ph.verify(argon2_hash, password)
        return True
    except Exception:
        return False
