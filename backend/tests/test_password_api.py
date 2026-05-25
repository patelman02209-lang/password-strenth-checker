import hashlib


def test_analyze_common_password(client, user_headers):
    r = client.post("/api/v1/analyze", headers=user_headers, json={"password": "password"})
    assert r.status_code == 200
    body = r.get_json()
    assert body["is_common"] is True
    assert body["strength_label"] in {"very_weak", "weak"}


def test_analyze_requires_auth(client):
    r = client.post("/api/v1/analyze", json={"password": "password"})
    assert r.status_code == 401


def test_generator_length_bounds(client, user_headers):
    r = client.post("/api/v1/generate", headers=user_headers, json={"length": 4})
    assert r.status_code == 400


def test_local_breach_file(tmp_path, client, user_headers):
    pw = "testpassword123!"
    h = hashlib.sha1(pw.encode()).hexdigest().upper()
    p = tmp_path / "breach.txt"
    p.write_text(f"{h}:100\n", encoding="utf-8")
    client.application.config["LOCAL_BREACH_FILE"] = str(p)
    r = client.post("/api/v1/local-breach", headers=user_headers, json={"password": pw})
    assert r.status_code == 200
    body = r.get_json()
    assert body["found"] is True
    assert body.get("breach_count", body.get("pwned_count")) >= 1


def test_hash_demo_requires_auth(client):
    r = client.post("/api/v1/hash-demo", json={"password": "x"})
    assert r.status_code == 401


def test_strength_endpoint_matches_analyze(client, user_headers):
    body = {"password": "SameForBoth!99"}
    a = client.post("/api/v1/analyze", headers=user_headers, json=body)
    s = client.post("/api/v1/strength", headers=user_headers, json=body)
    assert a.status_code == 200
    assert s.status_code == 200
    assert a.get_json()["strength_label"] == s.get_json()["strength_label"]


def test_analyze_rejects_empty_and_oversized_password(client, user_headers):
    e = client.post("/api/v1/analyze", headers=user_headers, json={"password": ""})
    assert e.status_code == 400
    assert "empty" in e.get_json()["msg"].lower()
    long_pw = "x" * 5000
    o = client.post("/api/v1/analyze", headers=user_headers, json={"password": long_pw})
    assert o.status_code == 400
    assert "maximum length" in o.get_json()["msg"].lower()


def test_generate_requires_json_object(client, user_headers):
    r = client.post(
        "/api/v1/generate",
        headers=user_headers,
        json=["not", "an", "object"],
    )
    assert r.status_code == 400


def test_password_history_invalid_pagination(client, user_headers):
    r = client.get("/api/v1/password/history?page=abc", headers=user_headers)
    assert r.status_code == 400


def test_hash_demo_response_shape_and_no_persisted_hashes(client, user_headers):
    from app.models import PasswordHashDemo

    before = PasswordHashDemo.query.count()
    r = client.post(
        "/api/v1/hash-demo",
        headers=user_headers,
        json={"password": "ClassroomDemo#1"},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["bcrypt"].startswith("$2")
    assert body["argon2id"].startswith("$argon2")
    assert isinstance(body["bcrypt_hash_time_ms"], (int, float))
    assert isinstance(body["argon2_hash_time_ms"], (int, float))
    assert body["bcrypt_hash_time_ms"] >= 0
    assert body["argon2_hash_time_ms"] >= 0
    assert body["bcrypt_metadata"]["output_char_length"] > 40
    assert body["bcrypt_metadata"].get("cost") is not None
    assert body["argon2_metadata"].get("memory_kib", 0) > 0
    assert "education" in body
    assert "one_way" in body["education"]
    assert "never_plaintext" in body["education"]
    assert isinstance(body["education"]["comparison"], list)
    assert PasswordHashDemo.query.count() == before


def test_password_history(client, user_headers):
    client.post("/api/v1/analyze", headers=user_headers, json={"password": "abc"})
    r = client.get("/api/v1/password/history", headers=user_headers)
    assert r.status_code == 200
    data = r.get_json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.get_json().get("status") == "ok"
