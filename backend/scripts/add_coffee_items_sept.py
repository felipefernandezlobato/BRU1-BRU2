#!/usr/bin/env python3
"""Add the September 2026 coffee gap between Escandallos and this catalog.

Covers four groups found by diffing the Escandallos 'Cafe' category against
this app's items:

  A. Brewing Dealers (BD) second wave, added to Escandallos 2026-09-03
  B. Two Dabov additions from 2026-09-10 (cost still 0.00 upstream)
  C. Frozen BD tubes + Frozen Mexico Geisha (priced from their origin bean,
     the same convention the existing Frozen items follow)
  D. Bulk per-kilo blends (MARRON / ROJO / BLACK / GOLD)

Also links the existing "COE Mexico 130g" to its Escandallos counterpart,
which is named "130g DABOV MEXICO Geisha" upstream and so never matched.

Idempotent: skips items that already exist (matched by name). Run once with
DATABASE_URL pointing at the Neon production connection string.
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Category, Item

CATEGORY_NAME = "Cafe & Te"

# (name, unit, cost_per_unit, escandallos_name, is_active)
ITEMS = [
    # A. Brewing Dealers, 2026-09-03
    ("Cafe 200g BD Euphoria", "unidad", 10.47, "200g BD Euphoria", True),
    ("Cafe 200g BD Blossom", "unidad", 9.75, "200g BD Blossom", True),
    ("Cafe 200g BD Blue Velvet", "unidad", 9.75, "200g BD Blue Velvet", True),
    ("Cafe 200g BD Lalo", "unidad", 9.52, "200g BD Lalo", True),
    ("Cafe 200g BD Offnight", "unidad", 9.05, "200g BD Offnight", True),
    ("Cafe 200g BD Enigma", "unidad", 8.82, "200g BD Enigma", True),
    ("Cafe 200g BD Teso", "unidad", 8.82, "200g BD Teso", True),
    ("Cafe 200g BD Baru", "unidad", 7.42, "200g BD Baru", True),
    ("Cafe 200g BD Savage", "unidad", 17.20, "200g BD Savage", True),
    ("Cafe 100g BD Savage", "unidad", 8.98, "100g BD Savage", True),
    # B. Dabov, 2026-09-10 — no purchase price upstream yet
    ("Ethiopia Karamo Washed 1kg", "unidad", 0.0,
     "1kg DABOV Ethiopia Karamo Washed", True),
    ("COE Salvador Los Angeles 2025 300g", "unidad", 0.0,
     "300g DABOV El Salvador Los Angeles COE#4 2025", True),
    # C. Frozen — cost mirrors the origin bean, as the existing Frozen items do
    ("Frozen BD Lalo", "unidad", 5.29, "Frozen BD Lalo Bru1", True),
    ("Frozen BD Lazo Bloom", "unidad", 9.37, "Frozen BD Lazo Bloom Bru1", True),
    ("Frozen BD Lord", "unidad", 9.28, "Frozen BD Lord Bru1", True),
    ("Frozen BD Meltic", "unidad", 8.33, "Frozen BD Meltic Bru1", True),
    ("Frozen BD Tennessee", "unidad", 8.51, "Frozen BD Tennessee Bru1", True),
    ("Frozen Mexico Geisha", "unidad", 9.90, "Frozen Mexico Geisha Bru1", True),
    # D. Bulk blends sold by the kilo — GOLD is inactive upstream
    ("Cafe Grano MARRON 1kg", "unidad", 22.98, "Café en grano MARRÓN", True),
    ("Cafe Grano ROJO 1kg", "unidad", 0.0, "Café en grano ROJO", True),
    ("Cafe Grano BLACK 1kg", "unidad", 0.0, "Café kilo BLACK", True),
    ("Cafe Grano GOLD 1kg", "unidad", 0.0, "Café kilo GOLD", False),
]

# Existing items whose Escandallos counterpart is named differently upstream.
RELINK = {
    "COE Mexico 130g": "130g DABOV MEXICO Geisha",
}


def main():
    db = SessionLocal()
    try:
        category = db.query(Category).filter(Category.name == CATEGORY_NAME).first()
        if category is None:
            print(f"ERROR: category '{CATEGORY_NAME}' not found")
            sys.exit(1)

        now = datetime.now(timezone.utc)
        created = 0
        for name, unit, cost, escandallos_name, is_active in ITEMS:
            existing = db.query(Item).filter(Item.name == name).first()
            if existing:
                print(f"skip (exists): {name}")
                continue
            db.add(Item(
                name=name,
                category_id=category.id,
                unit=unit,
                cost_per_unit=cost,
                is_produced=False,
                escandallos_name=escandallos_name,
                is_active=is_active,
                created_at=now,
                updated_at=now,
            ))
            created += 1
            print(f"created: {name} ({cost} CHF/{unit})"
                  f"{'' if is_active else ' [inactive]'}")

        relinked = 0
        for name, escandallos_name in RELINK.items():
            item = db.query(Item).filter(Item.name == name).first()
            if item is None:
                print(f"skip relink (missing): {name}")
                continue
            if item.escandallos_name == escandallos_name:
                print(f"skip relink (already set): {name}")
                continue
            item.escandallos_name = escandallos_name
            item.updated_at = now
            relinked += 1
            print(f"relinked: {name} -> {escandallos_name}")

        db.commit()
        print(f"\nDone. {created} item(s) created, {relinked} relinked.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
