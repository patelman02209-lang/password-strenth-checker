"""HIBP k-anonymity client and breach fallback behaviour."""

import hashlib
from pathlib import Path
from unittest import mock

import requests

from app.services.breach_check import check_password_breach
from app.services.hibp import lookup_pwned_password, query_pwned_range, sha1_hex_upper


def test_sha1_prefix_suffix_split():
    d = sha1_hex_upper("test")
    assert len(d) == 40
    assert len(d[:5]) == 5
    assert len(d[5:]) == 35


def test_query_pwned_range_parses_count():
    body = "00300A4E3A1234567890ABCDEF012345678:99\n"
    suffix = "00300A4E3A1234567890ABCDEF012345678"
    with mock.patch("app.services.hibp.requests.get") as g:
        g.return_value.status_code = 200
        g.return_value.text = body
        r = query_pwned_range("ABCDE", suffix, timeout=1.0, base_url="https://example.invalid/range/")
    assert r.ok is True
    assert r.breach_count == 99


def test_query_pwned_range_timeout():
    with mock.patch("app.services.hibp.requests.get", side_effect=requests.Timeout):
        r = query_pwned_range("ABCDE", "0" * 35, timeout=0.01, base_url="https://example.invalid/range/")
    assert r.ok is False
    assert "timeout" in (r.error or "")


def test_fallback_to_local_when_hibp_fails(tmp_path: Path):
    secret = "offline-fallback-secret!"
    digest = hashlib.sha1(secret.encode(), usedforsecurity=False).hexdigest().upper()
    f = tmp_path / "breach.txt"
    f.write_text(f"{digest}:77\n", encoding="utf-8")

    with mock.patch("app.services.hibp.requests.get", side_effect=requests.ConnectionError):
        r = check_password_breach(
            secret,
            local_file_path=str(f),
            timeout=(0.1, 0.2),
        )
    assert r.hibp_ok is False
    assert r.local_found is True
    assert r.source == "local_fallback"
    assert r.breach_count == 77
    assert r.found is True


def test_lookup_pwned_password_success_via_requests_mock():
    pw = "unique-test-password-xyz-12345"
    d = sha1_hex_upper(pw)
    prefix, suffix = d[:5], d[5:]
    line = f"{suffix}:3\n"

    with mock.patch("app.services.hibp.requests.get") as g:
        g.return_value.status_code = 200
        g.return_value.text = line
        r = lookup_pwned_password(pw, timeout=1.0)
    assert r.ok is True
    assert r.breach_count == 3
    g.assert_called_once()
    url = g.call_args[0][0]
    assert url.endswith(f"/{prefix}")
