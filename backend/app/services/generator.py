"""
Cryptographically secure password and passphrase generation.

Uses Python's ``secrets`` module (OS-backed CSPRNG via ``os.urandom``). This module
does **not** persist generated values; HTTP handlers must not store them unless the
user explicitly saves (for example to the encrypted vault).
"""
from __future__ import annotations

import secrets
import string
from pathlib import Path

_AMBIGUOUS_LOWER = "lo"
_AMBIGUOUS_UPPER = "OI"
_AMBIGUOUS_DIGIT = "01"
_AMBIGUOUS_SYMBOL = "|"

_FALLBACK_WORDS = ("acorn", "broccoli", "canyon", "delta", "ember", "falcon", "galaxy", "harbor")

_PASSPHRASE_BANK: list[str] | None = None


def _load_passphrase_words() -> list[str]:
    base = Path(__file__).resolve().parent.parent / "data" / "passphrase_words.txt"
    if not base.is_file():
        return list(_FALLBACK_WORDS)
    words: list[str] = []
    for line in base.read_text(encoding="utf-8", errors="ignore").splitlines():
        w = line.strip().lower()
        if w and w.isalpha() and not w.startswith("#"):
            words.append(w)
    return words if words else list(_FALLBACK_WORDS)


def _passphrase_bank() -> list[str]:
    global _PASSPHRASE_BANK
    if _PASSPHRASE_BANK is None:
        _PASSPHRASE_BANK = _load_passphrase_words()
    return _PASSPHRASE_BANK


def _scrub(chars: str, *, avoid: bool, removal: str) -> str:
    if not avoid:
        return chars
    for ch in removal:
        chars = chars.replace(ch, "")
    return chars


def _build_alphabet(
    *,
    use_upper: bool,
    use_lower: bool,
    use_digits: bool,
    use_symbols: bool,
    avoid_ambiguous: bool,
) -> str:
    alphabet = ""
    if use_lower:
        alphabet += _scrub(string.ascii_lowercase, avoid=avoid_ambiguous, removal=_AMBIGUOUS_LOWER)
    if use_upper:
        alphabet += _scrub(string.ascii_uppercase, avoid=avoid_ambiguous, removal=_AMBIGUOUS_UPPER)
    if use_digits:
        alphabet += _scrub(string.digits, avoid=avoid_ambiguous, removal=_AMBIGUOUS_DIGIT)
    if use_symbols:
        sym = "!@#$%^&*()-_=+[]{};:,.?"
        alphabet += _scrub(sym, avoid=avoid_ambiguous, removal=_AMBIGUOUS_SYMBOL)
    if not alphabet:
        raise ValueError("at least one non-empty character class must be enabled")
    return alphabet


def _required_picks(
    *,
    use_upper: bool,
    use_lower: bool,
    use_digits: bool,
    use_symbols: bool,
    avoid_ambiguous: bool,
) -> list[str]:
    """One character from each enabled class so policy checks cannot all fall in one pool."""
    picks: list[str] = []
    if use_lower:
        pool = _scrub(string.ascii_lowercase, avoid=avoid_ambiguous, removal=_AMBIGUOUS_LOWER)
        if not pool:
            raise ValueError("ambiguous-safe mode removed all lowercase letters")
        picks.append(secrets.choice(pool))
    if use_upper:
        pool = _scrub(string.ascii_uppercase, avoid=avoid_ambiguous, removal=_AMBIGUOUS_UPPER)
        if not pool:
            raise ValueError("ambiguous-safe mode removed all uppercase letters")
        picks.append(secrets.choice(pool))
    if use_digits:
        pool = _scrub(string.digits, avoid=avoid_ambiguous, removal=_AMBIGUOUS_DIGIT)
        if not pool:
            raise ValueError("ambiguous-safe mode removed all digits")
        picks.append(secrets.choice(pool))
    if use_symbols:
        pool = _scrub("!@#$%^&*()-_=+[]{};:,.?", avoid=avoid_ambiguous, removal=_AMBIGUOUS_SYMBOL)
        if not pool:
            raise ValueError("ambiguous-safe mode removed all symbols")
        picks.append(secrets.choice(pool))
    return picks


def generate_password(
    length: int = 20,
    use_upper: bool = True,
    use_lower: bool = True,
    use_digits: bool = True,
    use_symbols: bool = True,
    avoid_ambiguous: bool = False,
) -> str:
    """
    Random password using ``secrets.choice`` over the enabled alphabet.

    After picking one character per enabled class, remaining positions are filled
    uniformly at random and the string is shuffled with ``secrets.SystemRandom``.
    """
    if length < 8 or length > 128:
        raise ValueError("length must be between 8 and 128")
    alphabet = _build_alphabet(
        use_upper=use_upper,
        use_lower=use_lower,
        use_digits=use_digits,
        use_symbols=use_symbols,
        avoid_ambiguous=avoid_ambiguous,
    )
    picks = _required_picks(
        use_upper=use_upper,
        use_lower=use_lower,
        use_digits=use_digits,
        use_symbols=use_symbols,
        avoid_ambiguous=avoid_ambiguous,
    )
    if length < len(picks):
        raise ValueError(f"length must be at least {len(picks)} to satisfy enabled character classes")

    chars = list(picks)
    for _ in range(length - len(picks)):
        chars.append(secrets.choice(alphabet))
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def generate_passphrase(
    word_count: int = 6,
    separator: str = "-",
    *,
    capitalize_words: bool = False,
) -> str:
    """
    Memorable passphrase: ``word_count`` words drawn independently with ``secrets.choice``.

    Words come from ``app/data/passphrase_words.txt`` (or a tiny built-in fallback).
    """
    if word_count < 2 or word_count > 16:
        raise ValueError("word_count must be between 2 and 16")
    sep = (separator if isinstance(separator, str) else "-")[:8]
    if not sep or any(ord(c) < 32 for c in sep):
        raise ValueError("separator must be non-empty printable ASCII (max 8 chars)")

    bank = _passphrase_bank()
    words = [secrets.choice(bank) for _ in range(word_count)]
    if capitalize_words:
        words = [w.capitalize() for w in words]
    return sep.join(words)


def generate_password_batch(
    count: int,
    *,
    length: int = 20,
    use_upper: bool = True,
    use_lower: bool = True,
    use_digits: bool = True,
    use_symbols: bool = True,
    avoid_ambiguous: bool = False,
) -> list[str]:
    if count < 1 or count > 10:
        raise ValueError("count must be between 1 and 10")
    return [
        generate_password(
            length,
            use_upper=use_upper,
            use_lower=use_lower,
            use_digits=use_digits,
            use_symbols=use_symbols,
            avoid_ambiguous=avoid_ambiguous,
        )
        for _ in range(count)
    ]


def generate_passphrase_batch(
    count: int,
    *,
    word_count: int = 6,
    separator: str = "-",
    capitalize_words: bool = False,
) -> list[str]:
    if count < 1 or count > 10:
        raise ValueError("count must be between 1 and 10")
    return [
        generate_passphrase(word_count, separator, capitalize_words=capitalize_words) for _ in range(count)
    ]
