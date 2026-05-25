"""Injection-style payloads, log escaping, and rate limits (defense-in-depth)."""

import pytest

from app.utils.sanitize import escape_for_log_fragment, normalize_optional_text
from app.utils.validation import validate_password_check_input


@pytest.mark.security
def test_vault_search_sql_injection_payload_returns_json_not_error(client, user_headers):
    """Search uses bound parameters; hostile ``q`` must not break the query."""
    r = client.get(
        "/api/v1/vault/items/search",
        headers=user_headers,
        query_string={"q": "%' OR '1'='1"},
    )
    assert r.status_code == 200
    assert "items" in r.get_json()


@pytest.mark.security
def test_vault_notes_strip_control_chars_preserving_visible_markup(client, user_headers):
    """``normalize_optional_text`` strips ASCII controls; HTML-like text stays literal (JSON/text, not HTML)."""
    raw = "note\x00<script>alert(1)</script>"
    c = client.post(
        "/api/v1/vault/items",
        headers=user_headers,
        json={"title": "X1", "password": "LongPassword!1", "notes": raw},
    )
    assert c.status_code == 201
    iid = c.get_json()["id"]
    lst = client.get("/api/v1/vault/items", headers=user_headers)
    row = next(x for x in lst.get_json()["items"] if x["id"] == iid)
    assert row["notes"] == "note<script>alert(1)</script>"


@pytest.mark.security
def test_escape_for_log_fragment_neutralizes_angle_brackets():
    s = escape_for_log_fragment("<img src=x onerror=alert(1)>")
    assert "&lt;" in s
    assert "&gt;" in s


def test_normalize_optional_text_strips_ascii_controls():
    raw = "hello\x00world"
    assert normalize_optional_text(raw, 100) == "helloworld"


def test_validate_password_check_input_strips_controls():
    pw, err = validate_password_check_input("ab\x08cd")
    assert err is None
    assert pw == "abcd"


@pytest.mark.security
def test_analyze_rate_limit_after_budget(client, user_headers):
    """``POST /analyze`` is limited (30/min); excess calls return 429."""
    last = 200
    for i in range(31):
        r = client.post("/api/v1/analyze", headers=user_headers, json={"password": f"rate-limit-test-{i}"})
        last = r.status_code
    assert last == 429
