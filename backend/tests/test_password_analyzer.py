"""Unit tests for ``password_analyzer`` (no HTTP, no persistence)."""

from app.services.password_analyzer import analyze_password


def test_entropy_low_for_repetition():
    r = analyze_password("aaaaaaaa")
    assert r.entropy_bits < 8
    assert "repeated_characters" in r.patterns


def test_keyboard_pattern_detected():
    r = analyze_password("prefixqwertysuffix")
    assert "keyboard_pattern" in r.patterns


def test_sequential_digits_and_letters():
    assert "sequential_digits" in analyze_password("ab12345cd").patterns
    assert "sequential_letters" in analyze_password("testabcdx").patterns


def test_date_year_pattern():
    r = analyze_password("mySecret2005!")
    assert "date_or_year_pattern" in r.patterns


def test_leetspeak_and_common():
    r = analyze_password("P@ssw0rd!")
    assert r.is_common or "leetspeak_substitution" in r.patterns or "predictable_word" in r.patterns


def test_long_random_reaches_high_strength():
    pw = "Xq2#Jw8*pL5^vN3&mR9*zK7+hT4%gY6-bF1"
    r = analyze_password(pw)
    assert r.strength_label in ("strong", "very_strong")
    assert r.complexity_score >= 72


def test_entropy_increases_with_charset_diversity():
    """Heuristic Shannon-style bits should grow when classes widen at fixed length."""
    mono = analyze_password("aaaaaaaa")
    mixed = analyze_password("aA1!aA1!")
    assert mixed.entropy_bits > mono.entropy_bits


def test_complexity_score_bounded():
    r = analyze_password("")
    assert 0 <= r.complexity_score <= 100
    r2 = analyze_password("Xq2#Jw8*pL5^vN3&mR9*zK7+hT4%gY6-bF1")
    assert 0 <= r2.complexity_score <= 100
