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


def test_seed_creates_the_keys_the_admin_ui_edits(db):
    """PUT only updates existing rows, so every key the UI edits must be seeded."""
    from app.seed import seed_data
    from app.services.fixed_costs import FIXED_COSTS, setting_keys

    seed_data(db)
    keys = {s.key for s in db.query(Setting).all()}

    assert "markup_pct" in keys
    assert "escandallos_api_url" in keys
    assert "monthly_rent" in keys
    for slug, _label, _amount, _estimado in FIXED_COSTS:
        for key in setting_keys(slug):
            assert key in keys


def test_update_monthly_rent(admin_client, admin_user, db):
    db.add(Setting(key="monthly_rent", value="0.00"))
    db.commit()

    resp = admin_client.put("/api/settings/monthly_rent", json={"value": "5945.50"})
    assert resp.status_code == 200
    assert resp.json()["value"] == "5945.50"
