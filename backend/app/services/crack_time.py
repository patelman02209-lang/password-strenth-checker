"""
Hashcat-style crack time *simulation*.

This is not a cryptanalytic guarantee: real crack times depend on algorithm
parameters, hardware, rules, masks, and dictionary quality. We expose a
transparent model so users can reason about relative risk.
"""
from __future__ import annotations

import math


def estimate_crack_seconds(
    entropy_bits: float,
    guesses_per_second: float = 10e9,
    safety_margin: float = 2.0,
) -> dict:
    """
    Brute-force style upper bound: 2^entropy / rate.

    `guesses_per_second` default approximates a strong GPU cluster order of magnitude.
    """
    if entropy_bits <= 0 or guesses_per_second <= 0:
        return {"seconds": 0.0, "human": "instant", "model": "bruteforce_upper_bound"}

    work = safety_margin * (2**entropy_bits)
    seconds = work / guesses_per_second
    human = _humanize_seconds(seconds)
    return {
        "seconds": seconds,
        "human": human,
        "model": "bruteforce_upper_bound",
        "guesses_per_second": guesses_per_second,
        "safety_margin": safety_margin,
    }


def _humanize_seconds(seconds: float) -> str:
    if seconds < 1:
        return "under a second"
    if seconds < 60:
        return f"{seconds:.1f} seconds"
    minutes = seconds / 60
    if minutes < 60:
        return f"{minutes:.1f} minutes"
    hours = minutes / 60
    if hours < 48:
        return f"{hours:.1f} hours"
    days = hours / 24
    if days < 365:
        return f"{days:.1f} days"
    years = days / 365.25
    if years < 1_000_000:
        return f"{years:.1f} years"
    return f"{years:.2e} years"
