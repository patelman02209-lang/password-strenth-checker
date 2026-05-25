def test_vault_create_list_password_hidden(client, user_headers):
    c = client.post(
        "/api/v1/vault/items",
        headers=user_headers,
        json={"title": "Example", "account_username": "me", "password": "S3cret!value"},
    )
    assert c.status_code == 201
    iid = c.get_json()["id"]
    lst = client.get("/api/v1/vault/items", headers=user_headers)
    assert lst.status_code == 200
    items = lst.get_json()["items"]
    assert items[0]["password_hidden"] is True
    assert items[0]["password"] is None
    assert items[0]["account_username"] == "me"

    rev = client.post(f"/api/v1/vault/items/{iid}/reveal-password", headers=user_headers)
    assert rev.status_code == 200
    assert rev.get_json()["password"] == "S3cret!value"


def test_vault_reveal_idor_other_user(client, user_headers):
    c = client.post(
        "/api/v1/vault/items",
        headers=user_headers,
        json={"title": "Mine", "password": "SecretOne!"},
    )
    iid = c.get_json()["id"]
    client.post(
        "/api/v1/auth/register",
        json={
            "username": "otheru",
            "email": "otheru@example.com",
            "password": "LongPassword!1",
        },
    )
    lo = client.post(
        "/api/v1/auth/login",
        json={"username": "otheru", "password": "LongPassword!1"},
    )
    h2 = {"Authorization": f"Bearer {lo.get_json()['access_token']}"}
    r = client.post(f"/api/v1/vault/items/{iid}/reveal-password", headers=h2)
    assert r.status_code == 404


def test_vault_update_and_search(client, user_headers):
    c = client.post(
        "/api/v1/vault/items",
        headers=user_headers,
        json={"title": "AlphaEntry", "account_username": "zebra", "password": "Xx1!"},
    )
    iid = c.get_json()["id"]
    p = client.patch(
        f"/api/v1/vault/items/{iid}",
        headers=user_headers,
        json={"title": "AlphaRenamed", "website_url": "https://ex.example"},
    )
    assert p.status_code == 200
    s = client.get("/api/v1/vault/items/search", headers=user_headers, query_string={"q": "Alpha"})
    assert s.status_code == 200
    ids = [x["id"] for x in s.get_json()["items"]]
    assert iid in ids
    s2 = client.get("/api/v1/vault/items/search", headers=user_headers, query_string={"q": "zebra"})
    assert iid in [x["id"] for x in s2.get_json()["items"]]


def test_vault_check_strength(client, user_headers):
    c = client.post(
        "/api/v1/vault/items",
        headers=user_headers,
        json={"title": "S", "password": "password"},
    )
    iid = c.get_json()["id"]
    r = client.post(f"/api/v1/vault/items/{iid}/check-strength", headers=user_headers)
    assert r.status_code == 200
    body = r.get_json()
    assert body["strength_label"] in {"very_weak", "weak"}
    assert "last_checked_at" in body
    lst = client.get("/api/v1/vault/items", headers=user_headers)
    row = next(x for x in lst.get_json()["items"] if x["id"] == iid)
    assert row["strength_label"] in {"very_weak", "weak"}
    assert row.get("last_checked_at")


def test_vault_get_one(client, user_headers):
    c = client.post(
        "/api/v1/vault/items",
        headers=user_headers,
        json={"title": "G1", "password": "Ab12!Ab12!"},
    )
    iid = c.get_json()["id"]
    g = client.get(f"/api/v1/vault/items/{iid}", headers=user_headers)
    assert g.status_code == 200
    assert g.get_json()["password_hidden"] is True
