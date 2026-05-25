def test_audit_me_requires_auth(client):
    assert client.get("/api/v1/audit/me").status_code == 401


def test_audit_me_returns_own_entries(client, user_headers):
    client.post("/api/v1/analyze", headers=user_headers, json={"password": "uniquepwforaudit!1"})
    r = client.get("/api/v1/audit/me", headers=user_headers)
    assert r.status_code == 200
    data = r.get_json()
    assert "items" in data
    assert data["total"] >= 1
    for row in data["items"]:
        assert row["user_id"] is not None


def test_audit_me_ok_for_admin(client, admin_headers):
    r = client.get("/api/v1/audit/me", headers=admin_headers)
    assert r.status_code == 200
