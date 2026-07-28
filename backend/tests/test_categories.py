def test_list_categories_no_auth(client, category_cafe, category_panaderia):
    """Categories list requires no auth -- staff need it for the movement form."""
    resp = client.get("/api/categories/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    # Should be ordered by position
    assert data[0]["name"] == "Cafe"
    assert data[1]["name"] == "Panadería"


def test_list_categories_ordered(client, db):
    from app.models import Category

    c1 = Category(name="Zebra", position=5)
    c2 = Category(name="Alpha", position=1)
    c3 = Category(name="Middle", position=3)
    db.add_all([c1, c2, c3])
    db.commit()

    resp = client.get("/api/categories/")
    data = resp.json()
    positions = [c["position"] for c in data]
    assert positions == sorted(positions)


def test_create_category_admin(admin_client, admin_user):
    resp = admin_client.post("/api/categories/", json={
        "name": "Bebidas",
        "position": 2,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Bebidas"
    assert data["position"] == 2
    assert data["is_active"] is True


def test_create_category_staff_forbidden(staff_client):
    resp = staff_client.post("/api/categories/", json={
        "name": "Hacked",
        "position": 0,
    })
    assert resp.status_code == 403


def test_update_category(admin_client, admin_user, category_cafe):
    resp = admin_client.put(f"/api/categories/{category_cafe.id}", json={
        "name": "Cafe Updated",
        "position": 10,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Cafe Updated"
    assert data["position"] == 10


def test_deactivate_category(admin_client, admin_user, category_cafe):
    resp = admin_client.delete(f"/api/categories/{category_cafe.id}")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Should not appear in list anymore
    resp = admin_client.get("/api/categories/")
    names = [c["name"] for c in resp.json()]
    assert "Cafe" not in names


def test_category_not_found(admin_client, admin_user):
    resp = admin_client.put("/api/categories/9999", json={"name": "Ghost"})
    assert resp.status_code == 404

    resp = admin_client.delete("/api/categories/9999")
    assert resp.status_code == 404
