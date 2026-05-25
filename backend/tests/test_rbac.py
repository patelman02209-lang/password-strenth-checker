import pytest


@pytest.mark.security
def test_admin_only(client, user_headers, admin_headers):
    r_user = client.get("/api/v1/admin/users", headers=user_headers)
    assert r_user.status_code == 403
    r_admin = client.get("/api/v1/admin/users", headers=admin_headers)
    assert r_admin.status_code == 200
    assert "users" in r_admin.get_json()
