"""
Password strength analysis engine (entropy, complexity, patterns, guidance).

Security & privacy
--------------------
- Plaintext passwords exist **only** as the ``password`` argument for the duration
  of ``analyze_password`` — never written to logs, disk, or the database from
  this module. Callers (e.g. HTTP routes) must likewise avoid persisting or
  logging raw passwords; only ``AnalysisResult`` metadata should be stored.
- Entropy and scores are **heuristic teaching models**, not cryptographic
  guarantees of guessing difficulty. Real attacks use dictionaries, rules,
  masks, and leaked corpora that shrink the effective search space.
"""
from __future__ import annotations

import math
import re
import string
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

# ---------------------------------------------------------------------------
# Dictionary / common-password corpus (offline, case-insensitive exact match
# plus fuzzy checks). Extend via ``app/data/common_passwords.txt``.
# ---------------------------------------------------------------------------
_TOP_COMMON = frozenset(
    {
        "password",
        "123456",
        "123456789",
        "qwerty",
        "abc123",
        "password1",
        "111111",
        "iloveyou",
        "admin",
        "welcome",
        "monkey",
        "letmein",
        "dragon",
        "sunshine",
        "princess",
        "football",
        "654321",
        "shadow",
        "master",
        "superman",
        "qazwsx",
        "trustno1",
        "login",
        "hello",
        "freedom",
        "whatever",
        "starwars",
    }
)


def _load_extended_common() -> set[str]:
    base = Path(__file__).resolve().parent.parent / "data" / "common_passwords.txt"
    words: set[str] = set(_TOP_COMMON)
    if base.exists():
        for line in base.read_text(encoding="utf-8", errors="ignore").splitlines():
            w = line.strip().lower()
            if w and not w.startswith("#"):
                words.add(w)
    return words


_COMMON = _load_extended_common()

# Short substrings that strongly indicate dictionary / template passwords even
# when the full string is not in _COMMON (never log the user's password).
_SUBSTRING_BAD = frozenset(
    {
        "password",
        "passw",
        "admin",
        "welcome",
        "letmein",
        "qwerty",
        "login",
        "master",
        "shadow",
    }
)

_COMMON_FIRST_NAMES = frozenset(
    {
        "john",
        "james",
        "mary",
        "michael",
        "david",
        "jennifer",
        "robert",
        "linda",
        "william",
        "patricia",
        "richard",
        "elizabeth",
        "joseph",
        "susan",
        "thomas",
        "jessica",
        "charles",
        "sarah",
        "daniel",
        "karen",
    }
)

# ---------------------------------------------------------------------------
# Keyboard geometry: horizontal rows (US QWERTY). Used to flag low-entropy
# muscle-memory walks (qwerty, asdf, 1234…), not to claim exhaustive coverage.
# ---------------------------------------------------------------------------
_KEYBOARD_ROWS = (
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
    "1234567890",
)

# Leetspeak / homoglyph normalization for *dictionary comparison only* — we do
# not mutate the user's string for entropy; we compare a derived form to lists.
_LEET_TRANSLATION = str.maketrans(
    {
        "@": "a",
        "4": "a",
        "8": "b",
        "(": "c",
        "<": "c",
        "3": "e",
        "€": "e",
        "1": "i",
        "!": "i",
        "|": "i",
        "0": "o",
        "5": "s",
        "$": "s",
        "7": "t",
        "+": "t",
        "2": "z",
    }
)

# Characters that often replace letters in passwords (pattern heuristic only;
# dictionary matching uses the broader ``_LEET_TRANSLATION`` map).
_LEET_GLYPHS = frozenset("@$!0")


@dataclass
class AnalysisResult:
    """Structured analysis; safe to persist except avoid storing alongside secrets."""

    entropy_bits: float
    complexity_score: int
    strength_label: str
    is_common: bool
    patterns: list[str]
    suggestions: list[str]
    charset_size: int


def _charset_size(password: str) -> int:
    """
    Cardinality of the character *pool* implied by classes present.

    We sum independent pools (lower + upper + digit + symbols) which matches
    the usual "NIST-style" charset-size heuristic for random passwords. It is
    an upper bound when the password does not actually use the full union evenly.
    """
    size = 0
    if any(c.islower() for c in password):
        size += 26
    if any(c.isupper() for c in password):
        size += 26
    if any(c.isdigit() for c in password):
        size += 10
    if any(c in string.punctuation or (not c.isalnum() and not c.isspace()) for c in password):
        size += 33
    return max(size, 1)


def _empirical_iid_bits(password: str) -> float:
    """
    Shannon bits for i.i.d. symbols drawn from the password's empirical frequency.

    This caps entropy for highly skewed strings (e.g. ``"aaaa"`` → 0 bits) while
    leaving well-mixed passwords close to the ``len * log2(|pool|)`` upper bound.
    """
    n = len(password)
    if n == 0:
        return 0.0
    h_per_char = 0.0
    for cnt in Counter(password).values():
        p = cnt / n
        h_per_char -= p * math.log2(p)
    return n * h_per_char


def _entropy_bits(password: str, charset: int, pattern_count: int) -> float:
    """
    Combine two classical upper bounds, then apply a small pattern penalty.

    1. **Class-model upper bound**: ``L * log2(C)`` — assumes each character is
       drawn uniformly from the union of all character classes observed (pool
       size ``C`` from ``_charset_size``). Optimistic if patterns exist.

    2. **Empirical single-symbol Shannon bound**: treats the password as an i.i.d.
       sequence over the observed character distribution (good for repetition).

    We take the **minimum** as a conservative teaching estimate, then subtract a
    few bits per distinct pattern class to reflect rule/mask attacks (still not
    a full credential-stuffing model).
    """
    if not password:
        return 0.0
    upper = len(password) * math.log2(max(charset, 2))
    empirical = _empirical_iid_bits(password)
    base = min(upper, empirical)
    # Pattern classes correlate with attacker dictionaries / masks — soft penalty.
    penalized = base - min(24.0, 3.5 * max(0, pattern_count))
    return max(0.0, round(penalized, 2))


def _leet_normalize(s: str) -> str:
    return s.lower().translate(_LEET_TRANSLATION)


def _is_common_password(password: str) -> bool:
    low = password.lower()
    if low in _COMMON:
        return True
    if _leet_normalize(password) in _COMMON:
        return True
    return False


def _has_dictionary_substring(password: str) -> bool:
    low = password.lower()
    norm = _leet_normalize(password)
    for frag in _SUBSTRING_BAD:
        if len(frag) >= 4 and (frag in low or frag in norm):
            return True
    return False


def _keyboard_run(lower: str, min_run: int = 4) -> bool:
    """Contiguous forward or reverse walk along a single keyboard / digit row."""
    for row in _KEYBOARD_ROWS:
        for i in range(len(row) - min_run + 1):
            fwd = row[i : i + min_run]
            if fwd in lower or fwd[::-1] in lower:
                return True
    return False


def _sequential_digits(password: str, min_len: int = 3) -> bool:
    """Ascending/descending digit runs within each contiguous digit substring."""
    for chunk in re.split(r"\D+", password):
        if len(chunk) < min_len:
            continue
        for i in range(len(chunk) - min_len + 1):
            window = [int(chunk[j]) for j in range(i, i + min_len)]
            if all(window[j + 1] - window[j] == 1 for j in range(min_len - 1)):
                return True
            if all(window[j] - window[j + 1] == 1 for j in range(min_len - 1)):
                return True
    return False


def _sequential_letters(password: str, min_len: int = 3) -> bool:
    """Alphabetical runs within each contiguous letter substring (case-insensitive)."""
    for chunk in re.split(r"[^a-zA-Z]+", password):
        if len(chunk) < min_len:
            continue
        letters = [c.lower() for c in chunk]
        for i in range(len(letters) - min_len + 1):
            ords = [ord(c) for c in letters[i : i + min_len]]
            if all(ords[j + 1] - ords[j] == 1 for j in range(min_len - 1)):
                return True
            if all(ords[j] - ords[j + 1] == 1 for j in range(min_len - 1)):
                return True
    return False


def _repeated_run(password: str) -> bool:
    return bool(re.search(r"(.)\1{2,}", password))


def _date_or_year(password: str) -> bool:
    # Years touch other alphanumerics: ``\b`` is unreliable next to letters because
    # digits are "word" characters in Python ``\w``. Use digit-adjacency guards.
    if re.search(r"(?<![0-9])(19|20)\d{2}(?![0-9])", password):
        return True
    if re.search(
        r"\b(0[1-9]|1[0-2])[/\-](0[1-9]|[12]\d|3[01])[/\-](19|20)?\d{2}\b",
        password,
    ):
        return True
    if re.search(r"\b\d{1,2}[/\-]\d{1,2}[/\-](19|20)\d{2}\b", password):
        return True
    return False


def _name_like(password: str) -> bool:
    low = password.lower()
    if low in _COMMON_FIRST_NAMES:
        return True
    if re.fullmatch(r"[A-Za-z]{3,12}", password) and password[0].isupper() and password[1:].islower():
        return True
    return False


def _predictable_word(password: str) -> bool:
    return bool(re.search(r"(?i)(password|pass|admin|user|login|welcome)", password))


def _leetspeak_substitution(password: str) -> bool:
    """Glyph substitutions typical of human-chosen ``p@ssw0rd`` templates."""
    if not re.search(r"[A-Za-z]{3,}", password):
        return False
    if not any(ch in _LEET_GLYPHS for ch in password):
        return False
    # Letter adjacent to classic leet glyph (not merely digits at word ends).
    if re.search(r"[a-zA-Z][@$!0][a-zA-Z]", password) or re.search(r"[@$!0][a-zA-Z]{2,}", password):
        return True
    if re.search(r"[a-zA-Z]{2,}[@$!0]", password):
        return True
    return False


def _detect_patterns(password: str) -> list[str]:
    """Return stable machine-readable pattern ids (sorted, deduped)."""
    pats: set[str] = set()
    lower = password.lower()

    if _keyboard_run(lower):
        pats.add("keyboard_pattern")
    if _sequential_digits(password):
        pats.add("sequential_digits")
    if _sequential_letters(password):
        pats.add("sequential_letters")
    if _repeated_run(password):
        pats.add("repeated_characters")
    if _predictable_word(password):
        pats.add("predictable_word")
    if _leetspeak_substitution(password):
        pats.add("leetspeak_substitution")
    if _date_or_year(password):
        pats.add("date_or_year_pattern")
    if _name_like(password):
        pats.add("name_like_pattern")
    if _has_dictionary_substring(password) and not _predictable_word(password):
        pats.add("dictionary_substring")

    return sorted(pats)


def _complexity_score(
    password: str,
    charset: int,
    patterns: list[str],
    is_common: bool,
) -> int:
    """
    Weighted 0–100 score from explicit signals (length, classes, uniqueness).

    This is intentionally separate from ``entropy_bits``: entropy approximates
    a statistical upper bound; the score encodes policy-style expectations
    (length, diversity, avoidance of known bad structure).
    """
    n = len(password)
    score = 0.0

    # Length: reward up to ~20 chars (diminishing via cap).
    score += min(32, n * 2)

    # Character classes (mutually additive bonuses).
    if any(c.islower() for c in password):
        score += 8
    if any(c.isupper() for c in password):
        score += 8
    if any(c.isdigit() for c in password):
        score += 8
    if any(c in string.punctuation or (not c.isalnum() and not c.isspace()) for c in password):
        score += 10

    # Uniqueness ratio: repeated glyphs shrink effective randomness.
    unique_ratio = len(set(password)) / n if n else 0.0
    score += 20 * unique_ratio

    # Pool size bonus (encourages mixing classes beyond minimal checks).
    if charset >= 52:
        score += 6
    if charset >= 72:
        score += 6
    if charset >= 90:
        score += 4

    penalties = {
        "keyboard_pattern": 14,
        "sequential_digits": 10,
        "sequential_letters": 10,
        "repeated_characters": 8,
        "predictable_word": 18,
        "leetspeak_substitution": 12,
        "date_or_year_pattern": 10,
        "name_like_pattern": 10,
        "dictionary_substring": 14,
    }
    for p in patterns:
        score -= penalties.get(p, 6)

    if is_common:
        score -= 45
    if _has_dictionary_substring(password) and not is_common:
        score -= 8

    return int(max(0, min(100, round(score))))


def _strength_label(score: int, is_common: bool, patterns: list[str]) -> str:
    """
    Map score to coarse labels (snake_case for API + DB).

    ``very_strong`` requires a high score *and* absence of high-risk patterns to
    avoid overstating passwords that merely look long.
    """
    high_risk = bool(
        is_common
        or (patterns and any(p in {"keyboard_pattern", "predictable_word", "dictionary_substring"} for p in patterns))
    )
    if score >= 90 and not high_risk and len(patterns) == 0:
        return "very_strong"
    if score >= 78 and not is_common:
        return "strong"
    if score >= 55:
        return "moderate"
    if score >= 32:
        return "weak"
    return "very_weak"


def _build_suggestions(
    password: str,
    charset: int,
    patterns: list[str],
    is_common: bool,
) -> list[str]:
    sug: list[str] = []
    if is_common:
        sug.append("This password matches a common or breached-corpus string — pick a unique passphrase instead.")
    if len(password) < 12:
        sug.append("Use at least 12 characters (prefer 14+) for better offline guessing resistance.")
    if len(password) < 16 and charset >= 72:
        sug.append("Longer passphrases beat complex short secrets; consider adding random words.")
    if charset < 62:
        sug.append("Mix lowercase, uppercase, digits, and symbols to widen the search space.")
    unique_ratio = len(set(password)) / len(password) if password else 0.0
    if unique_ratio < 0.5:
        sug.append("Increase character variety — many repeated symbols reduce effective entropy.")
    if "keyboard_pattern" in patterns:
        sug.append("Avoid keyboard walks (qwerty, asdf, 123456); they are heavily tried in rule attacks.")
    if "sequential_digits" in patterns or "sequential_letters" in patterns:
        sug.append("Avoid long ascending or descending sequences — easy for mask-based crackers.")
    if "repeated_characters" in patterns:
        sug.append("Avoid long runs of the same character (e.g. 'aaa'); rules and masks exploit these.")
    if "leetspeak_substitution" in patterns:
        sug.append("Leetspeak substitutions (@ for a, 0 for o) are in attacker dictionaries — avoid templates.")
    if "date_or_year_pattern" in patterns:
        sug.append("Dates and years are highly guessable — omit personal or calendar patterns.")
    if "name_like_pattern" in patterns:
        sug.append("Avoid names and simple capitalized words — use random words or a password manager.")
    if "predictable_word" in patterns or "dictionary_substring" in patterns:
        sug.append("Remove embedded dictionary words and predictable fragments.")
    if not sug:
        sug.append("Good baseline — consider a unique passphrase or password manager for memorability and rotation.")
    return sug


def analyze_password(password: str) -> AnalysisResult:
    """
    Analyze ``password`` entirely in memory; return only non-secret metadata.

    Never logs or persists the plaintext from this function.
    """
    if not password:
        return AnalysisResult(
            0.0,
            0,
            "empty",
            True,
            [],
            ["Choose a non-empty password."],
            1,
        )

    charset = _charset_size(password)
    patterns = _detect_patterns(password)
    is_common = _is_common_password(password)

    entropy = _entropy_bits(password, charset, len(set(patterns)))
    score = _complexity_score(password, charset, patterns, is_common)
    label = _strength_label(score, is_common, patterns)
    suggestions = _build_suggestions(password, charset, patterns, is_common)

    return AnalysisResult(
        entropy_bits=entropy,
        complexity_score=score,
        strength_label=label,
        is_common=is_common,
        patterns=patterns,
        suggestions=suggestions,
        charset_size=charset,
    )
