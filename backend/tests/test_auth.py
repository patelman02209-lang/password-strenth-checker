import pytest


@pytest.mark.security
def test_login_failure_uniform(client):
    r = client.post("/api/v1/auth/login", json={"username": "nope", "password": "bad"})
    assert r.status_code == 401


@pytest.mark.security
def test_register_and_login(client):
    r = client.post(
        "/api/v1/auth/register",
        json={
            "username": "alice",
            "email": "alice@example.com",
            "password": "LongPassword!1",
        },
    )
    assert r.status_code == 201
    r2 = client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "LongPassword!1"},
    )
    assert r2.status_code == 200
    assert "access_token" in r2.get_json()


@pytest.mark.security
def test_register_duplicate_no_enumeration(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "username": "dup1",
            "email": "dup@example.com",
            "password": "LongPassword!1",
        },
    )
    r2 = client.post(
        "/api/v1/auth/register",
        json={
            "username": "dup2",
            "email": "dup@example.com",
            "password": "LongPassword!1",
        },
    )
    assert r2.status_code == 400
    assert "Unable" in (r2.get_json() or {}).get("msg", "")


@pytest.mark.security
def test_logout_revokes_access_token(client):
    client.post(
        "/api/v1/auth/register",
        json={"username": "logu", "email": "logu@example.com", "password": "LongPassword!1"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "logu", "password": "LongPassword!1"},
    )
    body = login.get_json()
    access = body["access_token"]
    refresh = body["refresh_token"]
    headers = {"Authorization": f"Bearer {access}"}
    lo = client.post(
        "/api/v1/auth/logout",
        headers=headers,
        json={"refresh_token": refresh},
    )
    assert lo.status_code == 200
    blocked = client.get("/api/v1/vault/items", headers=headers)
    assert blocked.status_code == 401


@pytest.mark.security
def test_default_password_hash_is_bcrypt(client):
    client.post(
        "/api/v1/auth/register",
        json={"username": "bcryptu", "email": "bcryptu@example.com", "password": "LongPassword!1"},
    )
    from app.models import User

    with client.application.app_context():
        u = User.query.filter_by(email="bcryptu@example.com").first()
        assert u.password_hash_algorithm == "bcrypt"
        assert u.password_hash.startswith("$2")


@pytest.mark.security
def test_two_factor_gate(client):
    import pyotp

    client.post(
        "/api/v1/auth/register",
        json={
            "username": "bob",
            "email": "bob@example.com",
            "password": "LongPassword!1",
        },
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "bob", "password": "LongPassword!1"},
    )
    token = login.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/api/v1/auth/two_factor/setup", headers=headers)
    from app.extensions import db
    from app.models import User

    with client.application.app_context():
        u = User.query.filter_by(email="bob@example.com").first()
        secret = u.two_factor_secret
        code = pyotp.TOTP(secret).now()
    en = client.post("/api/v1/auth/two_factor/enable", headers=headers, json={"code": code})
    assert en.status_code == 200
    step1 = client.post(
        "/api/v1/auth/login",
        json={"username": "bob", "password": "LongPassword!1"},
    )
    assert step1.get_json().get("two_factor_required") is True
    pending = step1.get_json()["pending_token"]
    full = client.post(
        "/api/v1/auth/two_factor/verify",
        headers={"Authorization": f"Bearer {pending}"},
        json={"code": pyotp.TOTP(secret).now()},
    )
    assert full.status_code == 200
    access = full.get_json()["access_token"]
    blocked = client.get("/api/v1/vault/items", headers={"Authorization": f"Bearer {pending}"})
    assert blocked.status_code == 401
