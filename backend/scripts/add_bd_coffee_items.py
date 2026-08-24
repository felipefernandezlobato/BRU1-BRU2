#!/usr/bin/env python3
"""Add Brewing Dealers (BD) coffee items (1kg/200g/100g) to the item catalog.

Costs sourced from Escandallos ingredient records. Idempotent: skips items
that already exist (matched by name). Run once against local SQLite (default)
and once with DATABASE_URL set to the Neon production connection string.
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Category, Item

CATEGORY_NAME = "Cafe & Te"

ITEMS = [
    ("Cafe 1kg BD Foundation", "unidad", 18.70, "1kg BD Foundation"),
    ("Cafe 200g BD Foundation", "unidad", 4.49, "200g BD Foundation"),
    ("Cafe 200g BD Berraco", "unidad", 5.00, "200g BD Berraco"),
    ("Cafe 200g BD Tapa Dulce", "unidad", 5.19, "200g BD Tapa Dulce"),
    ("Cafe 200g BD Lord", "unidad", 9.28, "200g BD Lord"),
    ("Cafe 200g BD Lazo Bloom", "unidad", 9.37, "200g BD Lazo Bloom"),
    ("Cafe 100g BD Lalo", "unidad", 5.29, "100g BD Lalo"),
    ("Cafe 100g BD Meltic", "unidad", 8.33, "100g BD Meltic"),
    ("Cafe 100g BD Tennessee", "unidad", 8.51, "100g BD Tennessee"),
]


def main():
    db = SessionLocal()
    try:
        category = db.query(Category).filter(Category.name == CATEGORY_NAME).first()
        if category is None:
            print(f"ERROR: category '{CATEGORY_NAME}' not found")
            sys.exit(1)

        now = datetime.now(timezone.utc)
        created = 0
        for name, unit, cost, escandallos_name in ITEMS:
            existing = db.query(Item).filter(Item.name == name).first()
            if existing:
                print(f"skip (exists): {name}")
                continue
            item = Item(
                name=name,
                category_id=category.id,
                unit=unit,
                cost_per_unit=cost,
                is_produced=False,
                escandallos_name=escandallos_name,
                is_active=True,
                created_at=now,
                updated_at=now,
            )
            db.add(item)
            created += 1
            print(f"created: {name} ({cost} CHF/{unit})")

        db.commit()
        print(f"\nDone. {created} item(s) created.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
