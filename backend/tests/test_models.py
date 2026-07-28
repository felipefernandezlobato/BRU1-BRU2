from datetime import datetime

from app.models import (
    Category,
    CostHistory,
    Item,
    Movement,
    MovementLine,
    Setting,
    User,
)
from app.auth import hash_pin


def test_create_user(db):
    user = User(name="Test", pin_hash=hash_pin("1111"), role="staff")
    db.add(user)
    db.commit()
    db.refresh(user)
    assert user.id is not None
    assert user.name == "Test"
    assert user.role == "staff"
    assert user.is_active is True
    assert isinstance(user.created_at, datetime)


def test_create_category(db):
    cat = Category(name="Bebidas", position=2)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    assert cat.id is not None
    assert cat.name == "Bebidas"
    assert cat.position == 2
    assert cat.is_active is True


def test_create_item(db, category_cafe):
    item = Item(
        name="Colombia Huila 1kg",
        category_id=category_cafe.id,
        unit="unidad",
        cost_per_unit=16.00,
        is_produced=False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    assert item.id is not None
    assert item.name == "Colombia Huila 1kg"
    assert item.category_id == category_cafe.id
    assert item.cost_per_unit == 16.00
    assert item.is_produced is False
    assert item.is_active is True


def test_item_category_relationship(db, item_coffee, category_cafe):
    assert item_coffee.category.name == "Cafe"
    assert item_coffee in category_cafe.items


def test_create_movement_with_lines(db, admin_user, item_coffee, item_croissant):
    movement = Movement(
        direction="BRU1_TO_BRU2",
        created_by=admin_user.id,
        notes="Daily delivery",
        movement_date="2026-07-28",
    )
    db.add(movement)
    db.flush()

    line1 = MovementLine(
        movement_id=movement.id,
        item_id=item_coffee.id,
        quantity=2.0,
        unit="unidad",
        cost_per_unit_snapshot=18.50,
        markup_pct_snapshot=0.0,
        transfer_price_snapshot=18.50,
    )
    line2 = MovementLine(
        movement_id=movement.id,
        item_id=item_croissant.id,
        quantity=10.0,
        unit="unidad",
        cost_per_unit_snapshot=0.85,
        markup_pct_snapshot=30.0,
        transfer_price_snapshot=1.105,
    )
    db.add_all([line1, line2])
    db.commit()
    db.refresh(movement)

    assert movement.id is not None
    assert len(movement.lines) == 2
    assert movement.creator.name == "Admin"


def test_cascade_delete_movement_lines(db, admin_user, item_coffee):
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
        quantity=5.0,
        unit="unidad",
        cost_per_unit_snapshot=18.50,
        markup_pct_snapshot=0.0,
        transfer_price_snapshot=18.50,
    )
    db.add(line)
    db.commit()

    # Delete the movement — lines should cascade
    db.delete(movement)
    db.commit()

    remaining = db.query(MovementLine).all()
    assert len(remaining) == 0


def test_setting_unique_key(db):
    s1 = Setting(key="markup_pct", value="30")
    db.add(s1)
    db.commit()

    s2 = Setting(key="markup_pct", value="25")
    db.add(s2)
    try:
        db.commit()
        assert False, "Should have raised IntegrityError"
    except Exception:
        db.rollback()


def test_create_cost_history(db, item_coffee):
    history = CostHistory(
        item_id=item_coffee.id,
        old_cost=18.50,
        new_cost=19.00,
        change_source="manual",
    )
    db.add(history)
    db.commit()
    db.refresh(history)

    assert history.id is not None
    assert history.old_cost == 18.50
    assert history.new_cost == 19.00
    assert history.change_source == "manual"
    assert history.item.name == "Ethiopia Yirgacheffe 1kg"
    assert isinstance(history.changed_at, datetime)


def test_user_movements_relationship(db, admin_user, item_coffee):
    movement = Movement(
        direction="BRU1_TO_BRU2",
        created_by=admin_user.id,
        movement_date="2026-07-28",
    )
    db.add(movement)
    db.commit()
    db.refresh(admin_user)

    assert len(admin_user.movements) == 1
    assert admin_user.movements[0].direction == "BRU1_TO_BRU2"
