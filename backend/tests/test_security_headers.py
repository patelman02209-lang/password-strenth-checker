import pytest


@pytest.mark.security
def test_api_sets_baseline_security_headers(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.headers.get("X-Content-Type-Options") == "nosniff"
    assert r.headers.get("X-Frame-Options") == "DENY"
    assert "no-store" in (r.headers.get("Cache-Control") or "").lower()
    r2 = client.post("/api/v1/analyze", json={})
    assert r2.headers.get("X-Content-Type-Options") == "nosniff"
