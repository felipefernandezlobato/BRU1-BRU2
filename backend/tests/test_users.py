from app.auth import verify_pin


def test_list_users_admin(admin_client, admin_user, staff_user):
    resp = admin_client.get("/api/users/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    names = [u["name"] for u in data]
    assert "Admin" in names
    assert "Staff" in names
    # Must not include pin_hash
    for u in data:
        assert "pin_hash" not in u


def test_list_users_staff_forbidden(staff_client):
    resp = staff_client.get("/api/users/")
    assert resp.status_code == 403


def test_list_users_include_inactive(admin_client, admin_user, staff_user, db):
    from app.models import User
    from app.auth import hash_pin

    inactive = User(name="Inactive", pin_hash=hash_pin("9999"), role="staff", is_active=False)
    db.add(inactive)
    db.commit()

    # Without include_inactive, should only see active users
    resp = admin_client.get("/api/users/")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # With include_inactive, should see all
    resp = admin_client.get("/api/users/?include_inactive=true")
    assert resp.status_code == 200
    assert len(resp.json()) == 3


def test_create_user_success(admin_client, admin_user):
    resp = admin_client.post("/api/users/", json={
        "name": "NewUser",
        "pin": "4321",
        "role": "staff",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "NewUser"
    assert data["role"] == "staff"
    assert data["is_active"] is True
    assert "pin_hash" not in data


def test_create_user_duplicate_name(admin_client, admin_user, staff_user):
    resp = admin_client.post("/api/users/", json={
        "name": "Staff",
        "pin": "1111",
        "role": "staff",
    })
    assert resp.status_code == 400


def test_create_user_staff_forbidden(staff_client):
    resp = staff_client.post("/api/users/", json={
        "name": "Hacker",
        "pin": "0000",
        "role": "admin",
    })
    assert resp.status_code == 403


def test_update_user_name(admin_client, admin_user, staff_user):
    resp = admin_client.put(f"/api/users/{staff_user.id}", json={
        "name": "StaffRenamed",
    })
    assert resp.status_code == 200
    assert resp.json()["name"] == "StaffRenamed"


def test_update_user_pin_and_login(admin_client, client, admin_user, staff_user):
    resp = admin_client.put(f"/api/users/{staff_user.id}", json={
        "pin": "9999",
    })
    assert resp.status_code == 200

    # Verify login works with new pin
    resp = client.post("/api/auth/login", json={"name": "Staff", "pin": "9999"})
    assert resp.status_code == 200
    assert resp.json()["user"]["name"] == "Staff"


def test_update_user_cannot_demote_self(admin_client, admin_user):
    resp = admin_client.put(f"/api/users/{admin_user.id}", json={
        "role": "staff",
    })
    assert resp.status_code == 400


def test_deactivate_user_success(admin_client, admin_user, staff_user):
    resp = admin_client.delete(f"/api/users/{staff_user.id}")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_deactivate_last_admin(admin_client, admin_user):
    resp = admin_client.delete(f"/api/users/{admin_user.id}")
    assert resp.status_code == 400


def test_user_not_found(admin_client, admin_user):
    resp = admin_client.put("/api/users/9999", json={"name": "Ghost"})
    assert resp.status_code == 404

    resp = admin_client.delete("/api/users/9999")
    assert resp.status_code == 404
