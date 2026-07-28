from datetime import datetime, timedelta

import jwt

from app.auth import hash_pin, verify_pin, create_token, SECRET_KEY, ALGORITHM


def test_hash_and_verify_pin():
    hashed = hash_pin("1234")
    assert verify_pin("1234", hashed) is True
    assert verify_pin("0000", hashed) is False


def test_login_success(client, admin_user):
    resp = client.post("/api/auth/login", json={"name": "Admin", "pin": "1234"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["user"]["name"] == "Admin"
    assert data["user"]["role"] == "admin"


def test_login_wrong_pin(client, admin_user):
    resp = client.post("/api/auth/login", json={"name": "Admin", "pin": "9999"})
    assert resp.status_code == 401


def test_login_wrong_name(client, admin_user):
    resp = client.post("/api/auth/login", json={"name": "Nobody", "pin": "1234"})
    assert resp.status_code == 401


def test_login_inactive_user(client, db):
    from app.models import User

    user = User(name="Inactive", pin_hash=hash_pin("1111"), role="staff", is_active=False)
    db.add(user)
    db.commit()

    resp = client.post("/api/auth/login", json={"name": "Inactive", "pin": "1111"})
    assert resp.status_code == 401


def test_get_me_valid_token(admin_client, admin_user):
    resp = admin_client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Admin"
    assert data["id"] == admin_user.id


def test_get_me_invalid_token(client):
    client.headers.update({"Authorization": "Bearer invalidtoken123"})
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_get_me_expired_token(client, admin_user):
    payload = {
        "user_id": admin_user.id,
        "role": admin_user.role,
        "exp": datetime.utcnow() - timedelta(days=1),
    }
    expired_token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    client.headers.update({"Authorization": f"Bearer {expired_token}"})
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_public_users_list(client, admin_user, staff_user):
    resp = client.get("/api/auth/users")
    assert resp.status_code == 200
    data = resp.json()
    names = [u["name"] for u in data]
    assert "Admin" in names
    assert "Staff" in names
    # Should only have id and name, no pin_hash
    for u in data:
        assert "pin_hash" not in u
        assert "id" in u
        assert "name" in u


def test_health_check(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
