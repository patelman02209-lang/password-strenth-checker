"""Vault security report, CSV export, and auth security profile (no password leakage)."""


def test_vault_security_report_and_csv(client, user_headers):
    client.post(
        "/api/v1/vault/items",
        headers=user_headers,
        json={"title": "A", "password": "UniquePassword!9z"},
    )
    client.post(
        "/api/v1/vault/items",
        headers=user_headers,
        json={"title": "B", "password": "UniquePassword!9z"},
    )
    rep = client.get("/api/v1/vault/security-report", headers=user_headers)
    assert rep.status_code == 200
    j = rep.get_json()
    assert "health_score" in j
    assert j["totals"]["credentials"] == 2
    assert len(j["reuse_clusters"]) >= 1

    csv_r = client.get("/api/v1/vault/export/security-metadata.csv", headers=user_headers)
    assert csv_r.status_code == 200
    body = csv_r.get_data(as_text=True)
    headers = body.strip().split("\n")[0].split(",")
    assert "credential_id" in headers
    assert not any(h.strip().lower() == "password" for h in headers)
    assert "UniquePassword" not in body


def test_auth_security_profile(client, user_headers):
    r = client.get("/api/v1/auth/security-profile", headers=user_headers)
    assert r.status_code == 200
    j = r.get_json()
    assert "checklist" in j
    assert "vault_security" in j
    assert isinstance(j["checklist"], list)
    assert "two_factor_enabled" in j
