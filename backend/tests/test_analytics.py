from datetime import date

from app.models import Movement, MovementLine, Setting, Category, Item


def _create_test_movement(db, user, item, direction, movement_date, quantity, transfer_price):
    """Helper to create a movement with one line directly in DB."""
    m = Movement(
        direction=direction,
        created_by=user.id,
        movement_date=movement_date,
    )
    db.add(m)
    db.flush()
    line = MovementLine(
        movement_id=m.id,
        item_id=item.id,
        quantity=quantity,
        unit="unidad",
        cost_per_unit_snapshot=item.cost_per_unit,
        markup_pct_snapshot=0.0,
        transfer_price_snapshot=transfer_price,
    )
    db.add(line)
    db.commit()
    return m


def test_analytics_summary(admin_client, admin_user, item_coffee, db):
    today = date.today()
    date_str = today.isoformat()

    _create_test_movement(db, admin_user, item_coffee, "BRU1_TO_BRU2", date_str, 2, 18.50)
    _create_test_movement(db, admin_user, item_coffee, "BRU1_TO_BRU2", date_str, 3, 18.50)

    resp = admin_client.get("/api/analytics/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_month_cost"] == (2 * 18.50) + (3 * 18.50)
    assert data["current_month_movements"] == 2


def test_analytics_monthly(admin_client, admin_user, item_coffee, db):
    today = date.today()
    _create_test_movement(db, admin_user, item_coffee, "BRU1_TO_BRU2", today.isoformat(), 1, 18.50)

    resp = admin_client.get("/api/analytics/monthly?months=3")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    # First entry should be current month
    assert data[0]["year"] == today.year
    assert data[0]["month"] == today.month


def test_analytics_categories(admin_client, admin_user, item_coffee, item_croissant, db):
    today = date.today()
    _create_test_movement(db, admin_user, item_coffee, "BRU1_TO_BRU2", today.isoformat(), 2, 18.50)
    _create_test_movement(db, admin_user, item_croissant, "BRU1_TO_BRU2", today.isoformat(), 10, 1.10)

    start = f"{today.year}-{today.month:02d}-01"
    end = today.isoformat()
    resp = admin_client.get(f"/api/analytics/categories?start_date={start}&end_date={end}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    categories = {d["category"] for d in data}
    assert "Cafe" in categories
    assert "Panadería" in categories


def test_analytics_direction(admin_client, admin_user, item_coffee, db):
    today = date.today()
    _create_test_movement(db, admin_user, item_coffee, "BRU1_TO_BRU2", today.isoformat(), 2, 18.50)
    _create_test_movement(db, admin_user, item_coffee, "BRU2_TO_BRU1", today.isoformat(), 1, 18.50)

    start = f"{today.year}-{today.month:02d}-01"
    end = today.isoformat()
    resp = admin_client.get(f"/api/analytics/direction?start_date={start}&end_date={end}")
    assert resp.status_code == 200
    data = resp.json()
    directions = {d["direction"] for d in data}
    assert "BRU1_TO_BRU2" in directions
    assert "BRU2_TO_BRU1" in directions


def test_analytics_staff_forbidden(staff_client, staff_user):
    resp = staff_client.get("/api/analytics/summary")
    assert resp.status_code == 403

    resp = staff_client.get("/api/analytics/monthly")
    assert resp.status_code == 403
