from app.models import Setting


def test_list_settings_admin(admin_client, admin_user, db):
    db.add(Setting(key="markup_pct", value="30"))
    db.add(Setting(key="escandallos_api_url", value="https://example.com"))
    db.commit()

    resp = admin_client.get("/api/settings/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    keys = {s["key"] for s in data}
    assert "markup_pct" in keys


def test_list_settings_staff_forbidden(staff_client):
    resp = staff_client.get("/api/settings/")
    assert resp.status_code == 403


def test_update_setting_success(admin_client, admin_user, db):
    db.add(Setting(key="markup_pct", value="30"))
    db.commit()

    resp = admin_client.put("/api/settings/markup_pct", json={"value": "25"})
    assert resp.status_code == 200
    assert resp.json()["value"] == "25"


def test_update_setting_not_found(admin_client, admin_user):
    resp = admin_client.put("/api/settings/nonexistent", json={"value": "foo"})
    assert resp.status_code == 404
