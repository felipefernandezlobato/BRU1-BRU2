from datetime import datetime, timedelta

import pytest

from app.models import Setting, Movement, MovementLine


def _seed_markup(db, value="30"):
    """Seed a markup_pct setting."""
    existing = db.query(Setting).filter(Setting.key == "markup_pct").first()
    if existing:
        existing.value = value
    else:
        db.add(Setting(key="markup_pct", value=value))
    db.commit()


def test_create_movement_with_markup(
    staff_client, staff_user, item_coffee, item_croissant, db
):
    """Produced items get markup; non-produced do not."""
    _seed_markup(db, "30")

    resp = staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2",
        "movement_date": "2026-07-28",
        "notes": "Morning delivery",
        "lines": [
            {"item_id": item_coffee.id, "quantity": 2, "unit": "unidad"},
            {"item_id": item_croissant.id, "quantity": 10, "unit": "unidad"},
        ],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["direction"] == "BRU1_TO_BRU2"
    assert data["creator_name"] == "Staff"
    assert len(data["lines"]) == 2

    # Find the coffee line (non-produced: no markup)
    coffee_line = next(l for l in data["lines"] if l["item_id"] == item_coffee.id)
    assert coffee_line["cost_per_unit_snapshot"] == 18.50
    assert coffee_line["markup_pct_snapshot"] == 0.0
    assert coffee_line["transfer_price_snapshot"] == 18.50

    # Find the croissant line (produced: 30% markup)
    croissant_line = next(l for l in data["lines"] if l["item_id"] == item_croissant.id)
    assert croissant_line["cost_per_unit_snapshot"] == 0.85
    assert croissant_line["markup_pct_snapshot"] == 30.0
    expected_transfer = round(0.85 * 1.30, 4)
    assert croissant_line["transfer_price_snapshot"] == expected_transfer

    # Verify total_cost
    expected_total = (18.50 * 2) + (expected_transfer * 10)
    assert data["total_cost"] == round(expected_total, 4)


def test_create_movement_empty_lines(staff_client, staff_user, db):
    _seed_markup(db)
    resp = staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2",
        "movement_date": "2026-07-28",
        "lines": [],
    })
    assert resp.status_code == 400


def test_create_movement_invalid_direction(staff_client, staff_user, item_coffee, db):
    _seed_markup(db)
    resp = staff_client.post("/api/movements/", json={
        "direction": "INVALID",
        "movement_date": "2026-07-28",
        "lines": [
            {"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"},
        ],
    })
    assert resp.status_code == 400


def test_create_movement_unauthenticated(client, item_coffee):
    resp = client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2",
        "movement_date": "2026-07-28",
        "lines": [
            {"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"},
        ],
    })
    assert resp.status_code in (401, 403)


def test_list_movements(staff_client, staff_user, item_coffee, db):
    _seed_markup(db)

    # Create two movements on different dates
    staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2",
        "movement_date": "2026-07-25",
        "lines": [{"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"}],
    })
    staff_client.post("/api/movements/", json={
        "direction": "BRU2_TO_BRU1",
        "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 2, "unit": "unidad"}],
    })

    resp = staff_client.get("/api/movements/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    # Ordered by movement_date desc
    assert data[0]["movement_date"] == "2026-07-28"
    assert data[1]["movement_date"] == "2026-07-25"


def test_list_movements_date_filter(staff_client, staff_user, item_coffee, db):
    _seed_markup(db)

    staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2",
        "movement_date": "2026-07-20",
        "lines": [{"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"}],
    })
    staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2",
        "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 2, "unit": "unidad"}],
    })

    resp = staff_client.get("/api/movements/?start_date=2026-07-25&end_date=2026-07-30")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["movement_date"] == "2026-07-28"


def test_get_movement_detail(staff_client, staff_user, item_coffee, db):
    _seed_markup(db)

    create_resp = staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2",
        "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 3, "unit": "unidad"}],
    })
    movement_id = create_resp.json()["id"]

    resp = staff_client.get(f"/api/movements/{movement_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == movement_id
    assert len(data["lines"]) == 1
    assert data["lines"][0]["item_name"] == "Ethiopia Yirgacheffe 1kg"


def test_delete_own_movement_staff(staff_client, staff_user, item_coffee, db):
    _seed_markup(db)

    create_resp = staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2",
        "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"}],
    })
    movement_id = create_resp.json()["id"]

    resp = staff_client.delete(f"/api/movements/{movement_id}")
    assert resp.status_code == 200


def test_delete_other_movement_staff_forbidden(
    staff_client, staff_user, admin_user, item_coffee, db
):
    _seed_markup(db)

    # Create movement owned by admin directly in DB
    movement = Movement(
        direction="BRU1_TO_BRU2",
        created_by=admin_user.id,
        movement_date="2026-07-28",
    )
    db.add(movement)
    db.flush()
    line = MovementLine(
        movement_id=movement.id,
        item_id=item_coffee.id,
        quantity=1,
        unit="unidad",
        cost_per_unit_snapshot=18.50,
        markup_pct_snapshot=0.0,
        transfer_price_snapshot=18.50,
    )
    db.add(line)
    db.commit()

    # Staff tries to delete admin's movement
    resp = staff_client.delete(f"/api/movements/{movement.id}")
    assert resp.status_code == 403


def test_admin_delete_any_movement(
    admin_client, admin_user, staff_user, item_coffee, db
):
    _seed_markup(db)

    # Create movement owned by staff directly in DB
    movement = Movement(
        direction="BRU1_TO_BRU2",
        created_by=staff_user.id,
        movement_date="2026-07-28",
    )
    db.add(movement)
    db.flush()
    line = MovementLine(
        movement_id=movement.id,
        item_id=item_coffee.id,
        quantity=1,
        unit="unidad",
        cost_per_unit_snapshot=18.50,
        markup_pct_snapshot=0.0,
        transfer_price_snapshot=18.50,
    )
    db.add(line)
    db.commit()

    # Admin can delete staff's movement
    resp = admin_client.delete(f"/api/movements/{movement.id}")
    assert resp.status_code == 200


def test_delete_after_24h_staff_forbidden(staff_client, staff_user, item_coffee, db):
    _seed_markup(db)

    # Create movement directly in DB with old timestamp
    movement = Movement(
        direction="BRU1_TO_BRU2",
        created_by=staff_user.id,
        movement_date="2026-07-26",
        created_at=datetime.utcnow() - timedelta(hours=25),
    )
    db.add(movement)
    db.flush()
    line = MovementLine(
        movement_id=movement.id,
        item_id=item_coffee.id,
        quantity=1,
        unit="unidad",
        cost_per_unit_snapshot=18.50,
        markup_pct_snapshot=0.0,
        transfer_price_snapshot=18.50,
    )
    db.add(line)
    db.commit()

    resp = staff_client.delete(f"/api/movements/{movement.id}")
    assert resp.status_code == 403


def test_edit_movement_lines_recalculated(
    staff_client, staff_user, item_coffee, item_croissant, db
):
    _seed_markup(db, "30")

    # Create with coffee only
    create_resp = staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2",
        "movement_date": "2026-07-28",
        "lines": [
            {"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"},
        ],
    })
    movement_id = create_resp.json()["id"]

    # Update: replace lines with croissant
    resp = staff_client.put(f"/api/movements/{movement_id}", json={
        "lines": [
            {"item_id": item_croissant.id, "quantity": 5, "unit": "unidad"},
        ],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["lines"]) == 1
    assert data["lines"][0]["item_id"] == item_croissant.id
    assert data["lines"][0]["markup_pct_snapshot"] == 30.0
