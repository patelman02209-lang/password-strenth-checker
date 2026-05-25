from app.services.audit_sanitize import audit_metadata_json_for_csv, sanitize_audit_metadata


def test_sanitize_redacts_sensitive_keys():
    out = sanitize_audit_metadata({"password": "x", "nested": {"api_key": "k"}, "safe": 3})
    assert out["password"] == "[redacted]"
    assert out["nested"]["api_key"] == "[redacted]"
    assert out["safe"] == 3


def test_sanitize_truncates_long_strings():
    long = "a" * 3000
    out = sanitize_audit_metadata({"note": long})
    assert isinstance(out["note"], str)
    assert len(out["note"]) < len(long)
    assert "truncated" in out["note"]


def test_audit_metadata_json_for_csv_bounded():
    s = audit_metadata_json_for_csv({"a": "b"})
    assert "a" in s
    assert len(s) <= 8000
