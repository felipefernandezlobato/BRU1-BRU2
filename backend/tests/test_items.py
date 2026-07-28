def test_list_items(admin_client, admin_user, item_coffee, item_croissant):
    resp = admin_client.get("/api/items/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    # Ordered by name
    names = [i["name"] for i in data]
    assert names == sorted(names)
    # Each item should have category_name
    for item in data:
        assert "category_name" in item
        assert item["category_name"] != ""


def test_list_items_category_filter(admin_client, admin_user, item_coffee, item_croissant, category_cafe):
    resp = admin_client.get(f"/api/items/?category_id={category_cafe.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Ethiopia Yirgacheffe 1kg"
    assert data[0]["category_name"] == "Cafe"


def test_list_items_unauthenticated(client):
    resp = client.get("/api/items/")
    assert resp.status_code in (401, 403)


def test_create_item_success(admin_client, admin_user, category_cafe):
    resp = admin_client.post("/api/items/", json={
        "name": "Colombia Supremo 1kg",
        "category_id": category_cafe.id,
        "unit": "unidad",
        "cost_per_unit": 22.00,
        "is_produced": False,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Colombia Supremo 1kg"
    assert data["category_name"] == "Cafe"
    assert data["cost_per_unit"] == 22.00


def test_create_item_invalid_category(admin_client, admin_user):
    resp = admin_client.post("/api/items/", json={
        "name": "Ghost Item",
        "category_id": 9999,
        "unit": "unidad",
    })
    assert resp.status_code == 400


def test_create_item_staff_forbidden(staff_client, category_cafe):
    resp = staff_client.post("/api/items/", json={
        "name": "Hacked",
        "category_id": category_cafe.id,
        "unit": "unidad",
    })
    assert resp.status_code == 403


def test_update_item_cost_creates_history(admin_client, admin_user, item_coffee, db):
    from app.models import CostHistory

    resp = admin_client.put(f"/api/items/{item_coffee.id}", json={
        "cost_per_unit": 20.00,
    })
    assert resp.status_code == 200
    assert resp.json()["cost_per_unit"] == 20.00

    # Check cost history was created
    history = db.query(CostHistory).filter(CostHistory.item_id == item_coffee.id).all()
    assert len(history) == 1
    assert history[0].old_cost == 18.50
    assert history[0].new_cost == 20.00
    assert history[0].change_source == "manual"


def test_update_item_name_no_history(admin_client, admin_user, item_coffee, db):
    from app.models import CostHistory

    resp = admin_client.put(f"/api/items/{item_coffee.id}", json={
        "name": "Renamed Coffee",
    })
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed Coffee"

    # No cost history should be created
    history = db.query(CostHistory).filter(CostHistory.item_id == item_coffee.id).all()
    assert len(history) == 0


def test_deactivate_item(admin_client, admin_user, item_coffee):
    resp = admin_client.delete(f"/api/items/{item_coffee.id}")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_item_not_found(admin_client, admin_user):
    resp = admin_client.get("/api/items/9999")
    assert resp.status_code == 404

    resp = admin_client.put("/api/items/9999", json={"name": "Ghost"})
    assert resp.status_code == 404

    resp = admin_client.delete("/api/items/9999")
    assert resp.status_code == 404
