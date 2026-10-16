#!/usr/bin/env python3
"""Add the coffee lines Sergio left in the notes of movement #184 (Mon 12 Oct).

The Brewing Dealers shipment arrived before the catalog had items for it, so he
typed the coffees into the movement's notes field instead. The movement's ten
existing line items are all pastries, milk and bowls, so 39 units of coffee
were never costed.

The note names coffees by varietal/origin rather than by BD trade name; the
mapping below was confirmed by Felipe against the BD order #1374 (5 Oct):

    Wash Ecuador        -> Tennessee        Lazo Bloom colombia -> Lazo Bloom
    Lalo geisha         -> Lalo             Blossom Colombia    -> Blossom
    Pink bourbon        -> Blue Velvet      Caturra Colombia    -> Enigma
    Wash Colombia       -> Euphoria         SI28 Colombia       -> Teso
    Tipica costa rica   -> Tapa Dulce       Fundacion Caturra   -> Foundation

Sizes follow the 24 Aug BD transfer, the only precedent: Lalo and Tennessee
moved as 100g, everything else as 200g including Foundation (confirmed).

Costs are read from the catalog at run time rather than hardcoded, so the
snapshot matches whatever the item costs when this runs.

The original note is left untouched as the staff's own record of the delivery.

Idempotent: a coffee line already present on the movement is skipped. A second
run reporting "0 added" is the proof the first one landed.

    DATABASE_URL='<neon-url>' python scripts/fix_movement_184_coffee.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Item, Movement, MovementLine

MOVEMENT_ID = 184

# (item name, quantity, the note line it came from)
COFFEE_LINES = [
    ("Cafe 100g BD Tennessee", 5, "Wash Ecuador 5"),
    ("Cafe 100g BD Lalo", 2, "Lalo geisha 2"),
    ("Cafe 200g BD Blue Velvet", 3, "Pink bourbon 3"),
    ("Cafe 200g BD Euphoria", 3, "Wash Colombia 3"),
    ("Cafe 200g BD Tapa Dulce", 3, "Tipica costa rica 3"),
    ("Cafe 200g BD Lazo Bloom", 5, "Lazo Bloom colombia 5"),
    ("Cafe 200g BD Blossom", 4, "Blossom Colombia 4"),
    ("Cafe 200g BD Enigma", 4, "Caturra Colombia 4"),
    ("Cafe 200g BD Teso", 4, "SI28 Colombia 4"),
    ("Cafe 200g BD Foundation", 6, "Fundacion  Caturra 6"),
]


def main():
    db = SessionLocal()
    try:
        movement = db.query(Movement).filter(Movement.id == MOVEMENT_ID).first()
        if not movement:
            raise SystemExit(f"movement #{MOVEMENT_ID} not found")
        print(f"movement #{MOVEMENT_ID}  {movement.movement_date}  {movement.direction}")

        existing = {
            line.item_id
            for line in db.query(MovementLine).filter(
                MovementLine.movement_id == MOVEMENT_ID
            )
        }

        added = 0
        total = 0.0
        for name, qty, note in COFFEE_LINES:
            item = db.query(Item).filter(Item.name == name).first()
            if not item:
                print(f"  MISSING  {name} (no such item)")
                continue
            if item.id in existing:
                print(f"  skip     {name} (already on this movement)")
                continue

            # None of these are produced at BRU1, so they transfer at cost.
            cost = item.cost_per_unit
            db.add(MovementLine(
                movement_id=MOVEMENT_ID,
                item_id=item.id,
                quantity=qty,
                unit=item.unit,
                cost_per_unit_snapshot=cost,
                markup_pct_snapshot=0.0,
                transfer_price_snapshot=cost,
            ))
            line_total = qty * cost
            total += line_total
            print(f"  add      {name[:30]:30} {qty} x {cost:6.2f} = {line_total:7.2f}   [{note}]")
            added += 1

        db.commit()
        print(f"\n{added} lines added, {total:.2f} CHF")
    finally:
        db.close()


if __name__ == "__main__":
    main()
