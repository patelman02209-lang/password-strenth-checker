def test_admin_dashboard_and_security_summary(client, admin_headers):
    d = client.get("/api/v1/admin/dashboard", headers=admin_headers)
    assert d.status_code == 200
    body = d.get_json()
    assert "total_users" in body
    s = client.get("/api/v1/admin/security-summaries", headers=admin_headers)
    assert s.status_code == 200
    assert "total_password_checks" in s.get_json()


def test_admin_analytics_combined(client, admin_headers):
    r = client.get("/api/v1/admin/analytics", headers=admin_headers)
    assert r.status_code == 200
    j = r.get_json()
    assert j["window_hours"] == 24
    assert "total" in j["users"]
    assert "password_checks" in j["last_24h"]
    assert j["password_checks_all_time"]["total"] >= 0
    pc = j["password_checks_all_time"]
    assert "weak_password_pct" in pc
    assert "avg_entropy" in pc
    assert isinstance(j["top_detected_patterns"], list)
    assert isinstance(j["checks_per_day"], list)
    assert len(j["checks_per_day"]) == 14
    assert isinstance(j["users_by_check_volume"], list)

def test_admin_audit_logs_paginated(client, admin_headers):
    r = client.get("/api/v1/admin/audit-logs?page=1&per_page=10", headers=admin_headers)
    assert r.status_code == 200
    data = r.get_json()
    assert "items" in data
    assert data["page"] == 1


def test_admin_patch_user(client, admin_headers):
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": "patchme",
            "email": "patchme@example.com",
            "password": "LongPassword!1",
        },
    )
    assert reg.status_code == 201
    uid = reg.get_json()["user_id"]
    p = client.patch(
        f"/api/v1/admin/users/{uid}",
        headers=admin_headers,
        json={"status": "DISABLED"},
    )
    assert p.status_code == 200
    assert p.get_json()["status"] == "DISABLED"


def test_admin_routes_forbidden_for_user(client, user_headers):
    assert client.get("/api/v1/admin/dashboard", headers=user_headers).status_code == 403
    assert client.get("/api/v1/admin/analytics", headers=user_headers).status_code == 403


def test_admin_audit_logs_filter_and_csv_export(client, admin_headers):
    client.post("/api/v1/auth/login", json={"username": "notauser", "password": "wrong"})
    r = client.get("/api/v1/admin/audit-logs?action=login_failed&per_page=5", headers=admin_headers)
    assert r.status_code == 200
    body = r.get_json()
    assert body["total"] >= 1
    for row in body["items"]:
        assert "login_failed" in row["action"]

    exp = client.get("/api/v1/admin/audit-logs/export.csv?action=login_failed", headers=admin_headers)
    assert exp.status_code == 200
    assert "csv" in (exp.headers.get("Content-Type") or "").lower()
    raw = exp.get_data(as_text=True)
    assert "login_failed" in raw
    assert "metadata_json_sanitized" in raw


def test_admin_security_activity(client, admin_headers, user_headers):
    r = client.get("/api/v1/admin/security/activity?days=7", headers=user_headers)
    assert r.status_code == 403
    ok = client.get("/api/v1/admin/security/activity?days=7", headers=admin_headers)
    assert ok.status_code == 200
    j = ok.get_json()
    assert "failed_logins" in j
    assert "password_activity" in j
    assert "vault_activity" in j
    assert "recent_failed_logins" in j


def test_admin_audit_export_forbidden_for_user(client, user_headers):
    assert client.get("/api/v1/admin/audit-logs/export.csv", headers=user_headers).status_code == 403
