"""Password / passphrase generator service and API."""

from app.services.generator import (
    generate_passphrase,
    generate_password,
    generate_password_batch,
)


def test_generate_password_includes_each_enabled_class():
    pw = generate_password(12, use_upper=True, use_lower=True, use_digits=True, use_symbols=True)
    assert any(c.islower() for c in pw)
    assert any(c.isupper() for c in pw)
    assert any(c.isdigit() for c in pw)
    assert any(not c.isalnum() for c in pw)


def test_avoid_ambiguous_removes_confusing_chars():
    for _ in range(30):
        pw = generate_password(
            24,
            use_upper=True,
            use_lower=True,
            use_digits=True,
            use_symbols=True,
            avoid_ambiguous=True,
        )
        assert "l" not in pw
        assert "o" not in pw
        assert "O" not in pw
        assert "I" not in pw
        assert "0" not in pw
        assert "1" not in pw
        assert "|" not in pw


def test_passphrase_word_count():
    p = generate_passphrase(4, "-")
    assert p.count("-") == 3
    assert len(p.split("-")) == 4


def test_password_batch_unique():
    batch = generate_password_batch(5, length=16, use_lower=True, use_upper=False, use_digits=True, use_symbols=False)
    assert len(batch) == 5
    assert len(set(batch)) == 5


def test_generate_api_returns_options(client, user_headers):
    r = client.post(
        "/api/v1/generate",
        headers=user_headers,
        json={"count": 2, "length": 18, "avoid_ambiguous": True},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["count"] == 2
    assert len(body["options"]) == 2
    assert all("password" in o for o in body["options"])
    assert "analysis" in body["options"][0]
    assert "constraint_suggestions" in body["options"][0]


def test_generate_passphrase_mode(client, user_headers):
    r = client.post(
        "/api/v1/generate",
        headers=user_headers,
        json={"mode": "passphrase", "word_count": 5, "separator": "_", "count": 1},
    )
    assert r.status_code == 200
    pw = r.get_json()["password"]
    assert pw.count("_") == 4
