#!/usr/bin/env python3
"""Align Cafe & Te costs with Escandallos and add the missing BD coffees.

Snapshot of Escandallos' Cafe category taken 2026-10-16. Dabov raised prices
across most origins, and 46 of this catalog's coffee items had never been
linked upstream (escandallos_name was an empty string rather than NULL), so
they had been silently excluded from every cost sync.

Three parts:

  1. LINKS  -- populate escandallos_name, matched with the canonical
               (size, token-set) recipe in CLAUDE.md. Frozen items link to the
               upstream `* Bru1` row, following the existing convention.
  2. COSTS  -- set cost_per_unit and record a CostHistory row. Items priced at
               0.00 upstream are deliberately absent: overwriting a real cost
               with zero would corrupt every future movement. Frozen items take
               their cost from the origin bean (smallest size available), which
               reproduces the existing Frozen values exactly.
  3. NEW    -- the BD coffees missing from this catalog.

Idempotent: links and costs are only written when they differ, and items are
skipped if the name already exists. A second run reporting all zeros is the
proof the first one landed.

    DATABASE_URL='<neon-url>' python scripts/sync_cafe_costs_oct.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Category, CostHistory, Item

CATEGORY_NAME = "Cafe & Te"

# (bru_name, escandallos_name)
LINKS = [
    ('Brazil BY DABOV 200g', '200g DABOV Brazil BY DABOV'),
    ('Brazil By Dabov 1kg', '1kg DABOV Brazil By Dabov'),
    ('COE Ethiopia 130g', '130g DABOV COE Ethiopia'),
    ('COE Salvador 130g', '130g DABOV COE Salvador'),
    ('Capsula Brazil', 'Cápsula Brazil'),
    ('Capsula Colombia', 'Cápsula Colombia'),
    ('Capsula Decaf', 'Cápsula Decaf'),
    ('Capsula Ethiopia', 'Cápsula Ethiopia'),
    ('Capsulas Dabov', 'Cápsulas Dabov'),
    ('Colombia BY DABOV 1kg', '1kg DABOV Colombia BY DABOV'),
    ('Colombia BY DABOV 200g', '200g DABOV Colombia BY DABOV'),
    ('Colombia Banana 200g', '200g DABOV Colombia Banana'),
    ('Colombia Helena 1kg', '1kg DABOV Colombia Helena'),
    ('Colombia Helena 200g', '200g DABOV Colombia Helena'),
    ('Colombia Sugar Decaf 1kg', '1kg DABOV Colombia Sugar Decaf'),
    ('Costa Rica Tarrazu 1kg', '1kg DABOV Costa Rica Tarrazu'),
    ('Costa Rica Tarrazu 200g', '200g DABOV Costa Rica Tarrazu'),
    ('Costa Rica Thermal 200g', '200g DABOV Costa Rica Thermal'),
    ('Ethiopia Alo Mosto 200g', '200g DABOV Ethiopia Alo Mosto'),
    ('Ethiopia By Dabov 1kg', '1kg DABOV Ethiopia By Dabov'),
    ('Ethiopia By Dabov 200g', '200g DABOV Ethiopia By Dabov'),
    ('Ethiopia Karamo 200g', '200g DABOV Ethiopia Karamo'),
    ('Ethiopia Shantawene 1kg', '1kg DABOV Ethiopia Shantawene'),
    ('Frozen COE Ethiopia', 'Frozen COE Ethiopia Bru1'),
    ('Frozen COE Salvador', 'Frozen COE Salvador Bru1'),
    ('Frozen Colombia Banana Fermentation', 'Frozen Colombia Banana Fermentation Bru1'),
    ('Frozen Costa Rica La Ortiga', 'Frozen Costa Rica La Ortiga Bru1'),
    ('Frozen Ethiopia Alo Mosto', 'Frozen Ethiopia Alo Mosto Bru1'),
    ('Frozen Ethiopia Karamo', 'Frozen Ethiopia Karamo Bru1'),
    ('Frozen Mexico La Perla', 'Frozen Mexico La Perla Bru1'),
    ('Frozen Nicaragua El Suspiro', 'Frozen Nicaragua El Suspiro Bru1'),
    ('Frozen Panama Lerida', 'Frozen Panama Lerida Bru1'),
    ('Honduras Caballero 1kg', '1kg DABOV Honduras Caballero'),
    ('Honduras Caballero 200g', '200g DABOV Honduras Caballero'),
    ('Honduras El Puente 1kg', '1kg DABOV Honduras El Puente'),
    ('Honduras El Puente 200g', '200g DABOV Honduras El Puente'),
    ('Late Night Decaf 200g', '200g DABOV Late Night Decaf'),
    ('Mexico Fatima 1kg', '1kg DABOV Mexico Fatima'),
    ('Mexico Fatima 200g', '200g DABOV Mexico Fatima'),
    ('Mexico La Perla 200g', '200g DABOV Mexico La Perla'),
    ('Nicaragua El Suspiro 200g', '200g DABOV Nicaragua El Suspiro'),
    ('Nicaragua Gesha La Orquidea 200g', '200g DABOV Nicaragua La Orquidea Gesha'),
    ('Nicaragua La Huela 1kg', '1kg DABOV Nicaragua La Huela'),
    ('Nicaragua Los Placeres 1kg', '1kg DABOV Nicaragua Los Placeres'),
    ('Nicaragua Los Placeres 200g', '200g DABOV Nicaragua Los Placeres'),
    ('Nicaragua Mierish 200g', '200g DABOV Nicaragua Mierish'),
    ('Panama Lerida 200g', '200g DABOV Panama Lerida'),
    ('Retail BLACK 200g', 'Retail BLACK 200g'),
    ('Retail MARRON 200g', 'Retail MARRÓN 200g'),
    ('Retail ROJO 200g', 'Retail ROJO 200g'),
    ('Ruanda Mahembe 1kg', '1kg DABOV Ruanda Mahembe'),
    ('Rwanda Karongi 1kg', '1kg DABOV Rwanda Karongi'),
    ('Rwanda Karongi 200g', '200g DABOV Rwanda Karongi'),
    ('Rwanda Mahembe 200g', '200g DABOV Rwanda Mahembe'),
    ('Semi Decaf 200g', '200g DABOV Semi Decaf'),
]

# (bru_name, new_cost, upstream source the figure came from)
COSTS = [
    ('Brazil BY DABOV 200g', 4.36, '200g DABOV Brazil BY DABOV'),
    ('Brazil By Dabov 1kg', 20.02, '1kg DABOV Brazil By Dabov'),
    ('COE Ethiopia 130g', 9.83, '130g DABOV COE Ethiopia'),
    ('COE Mexico 130g', 9.9, '130g DABOV MEXICO Geisha'),
    ('COE Salvador 130g', 13.15, '130g DABOV COE Salvador'),
    ('Capsula Brazil', 3.9, 'Cápsula Brazil'),
    ('Capsula Colombia', 3.9, 'Cápsula Colombia'),
    ('Capsula Decaf', 3.9, 'Cápsula Decaf'),
    ('Capsula Ethiopia', 3.9, 'Cápsula Ethiopia'),
    ('Capsulas Dabov', 3.9, 'Cápsulas Dabov'),
    ('Colombia BY DABOV 1kg', 20.6, '1kg DABOV Colombia BY DABOV'),
    ('Colombia BY DABOV 200g', 4.83, '200g DABOV Colombia BY DABOV'),
    ('Colombia Banana 200g', 9.5, '200g DABOV Colombia Banana'),
    ('Colombia Helena 1kg', 23.64, '1kg DABOV Colombia Helena'),
    ('Colombia Helena 200g', 5.18, '200g DABOV Colombia Helena'),
    ('Colombia Sugar Decaf 1kg', 22.01, '1kg DABOV Colombia Sugar Decaf'),
    ('Costa Rica Tarrazu 1kg', 21.3, '1kg DABOV Costa Rica Tarrazu'),
    ('Costa Rica Tarrazu 200g', 4.66, '200g DABOV Costa Rica Tarrazu'),
    ('Costa Rica Thermal 200g', 8.02, '200g DABOV Costa Rica Thermal'),
    ('Ethiopia Alo Mosto 200g', 11.83, '200g DABOV Ethiopia Alo Mosto'),
    ('Ethiopia By Dabov 1kg', 25.44, '1kg DABOV Ethiopia By Dabov'),
    ('Ethiopia By Dabov 200g', 5.51, '200g DABOV Ethiopia By Dabov'),
    ('Ethiopia Karamo 200g', 7.72, '200g DABOV Ethiopia Karamo'),
    ('Ethiopia Shantawene 1kg', 24.76, '1kg DABOV Ethiopia Shantawene'),
    ('Frozen COE Ethiopia', 9.83, '130g DABOV COE Ethiopia'),
    ('Frozen COE Salvador', 13.15, '130g DABOV COE Salvador'),
    ('Frozen Colombia Banana Fermentation', 9.5, '200g DABOV Colombia Banana'),
    ('Frozen Ethiopia Alo Mosto', 11.83, '200g DABOV Ethiopia Alo Mosto'),
    ('Frozen Ethiopia Karamo', 7.72, '200g DABOV Ethiopia Karamo'),
    ('Frozen Mexico La Perla', 6.98, '200g DABOV Mexico La Perla'),
    ('Frozen Nicaragua El Suspiro', 5.9, '200g DABOV Nicaragua El Suspiro'),
    ('Frozen Panama Lerida', 10.97, '200g DABOV Panama Lerida'),
    ('Honduras Caballero 1kg', 22.18, '1kg DABOV Honduras Caballero'),
    ('Honduras Caballero 200g', 5.17, '200g DABOV Honduras Caballero'),
    ('Honduras El Puente 200g', 5.06, '200g DABOV Honduras El Puente'),
    ('Late Night Decaf 200g', 4.86, '200g DABOV Late Night Decaf'),
    ('Mexico Fatima 1kg', 23.88, '1kg DABOV Mexico Fatima'),
    ('Mexico Fatima 200g', 4.9, '200g DABOV Mexico Fatima'),
    ('Mexico La Perla 200g', 6.98, '200g DABOV Mexico La Perla'),
    ('Nicaragua El Suspiro 200g', 5.9, '200g DABOV Nicaragua El Suspiro'),
    ('Nicaragua Gesha La Orquidea 200g', 8.52, '200g DABOV Nicaragua La Orquidea Gesha'),
    ('Nicaragua La Huela 1kg', 21.97, '1kg DABOV Nicaragua La Huela'),
    ('Nicaragua Los Placeres 1kg', 20.32, '1kg DABOV Nicaragua Los Placeres'),
    ('Nicaragua Los Placeres 200g', 4.79, '200g DABOV Nicaragua Los Placeres'),
    ('Nicaragua Mierish 200g', 8.24, '200g DABOV Nicaragua Mierish'),
    ('Panama Lerida 200g', 10.97, '200g DABOV Panama Lerida'),
    ('Ruanda Mahembe 1kg', 22.26, '1kg DABOV Ruanda Mahembe'),
    ('Rwanda Karongi 1kg', 24.13, '1kg DABOV Rwanda Karongi'),
    ('Rwanda Karongi 200g', 5.2, '200g DABOV Rwanda Karongi'),
    ('Rwanda Mahembe 200g', 4.86, '200g DABOV Rwanda Mahembe'),
    ('Semi Decaf 200g', 4.86, '200g DABOV Semi Decaf'),
]

# (name, cost_per_unit, escandallos_name, cost source)
NEW_ITEMS = [
    ('Cafe 200g BD Tennessee', 18.98, '200g BD Tennessee', '200g BD Tennessee'),
    ('Frozen BD Blossom', 9.75, 'Frozen BD Blossom Bru1', '200g BD Blossom'),
    ('Frozen BD Blue Velvet', 9.75, 'Frozen BD Blue Velvet Bru1', '200g BD Blue Velvet'),
    ('Frozen BD Enigma', 8.82, 'Frozen BD Enigma Bru1', '200g BD Enigma'),
    ('Frozen BD Euphoria', 10.47, 'Frozen BD Euphoria Bru1', '200g BD Euphoria'),
    ('Frozen BD Savage', 8.98, 'Frozen BD Savage Bru1', '100g BD Savage'),
    ('Frozen BD Teso', 8.82, 'Frozen BD Teso Bru1', '200g BD Teso'),
]


def main():
    db = SessionLocal()
    cat = db.query(Category).filter(Category.name == CATEGORY_NAME).first()
    if not cat:
        raise SystemExit(f"category {CATEGORY_NAME!r} not found")

    linked = costed = created = 0
    try:
        for name, esc_name in LINKS:
            item = db.query(Item).filter(Item.name == name).first()
            if not item:
                print(f"  MISSING   {name} (no such item)")
                continue
            if (item.escandallos_name or "").strip() == esc_name:
                continue
            item.escandallos_name = esc_name
            print(f"  link      {name} <- {esc_name}")
            linked += 1

        for name, new_cost, src in COSTS:
            item = db.query(Item).filter(Item.name == name).first()
            if not item:
                print(f"  MISSING   {name} (no such item)")
                continue
            if abs(item.cost_per_unit - new_cost) < 0.005:
                continue
            old = item.cost_per_unit
            db.add(CostHistory(
                item_id=item.id, old_cost=old, new_cost=new_cost,
                change_source="sync",
            ))
            item.cost_per_unit = new_cost
            print(f"  cost      {name}: {old:.2f} -> {new_cost:.2f}  [{src}]")
            costed += 1

        for name, cost, esc_name, src in NEW_ITEMS:
            if db.query(Item).filter(Item.name == name).first():
                continue
            db.add(Item(
                name=name,
                category_id=cat.id,
                unit="unidad",
                cost_per_unit=cost,
                is_produced=False,
                escandallos_name=esc_name,
                is_active=True,
            ))
            print(f"  create    {name} @ {cost:.2f}  [{src}]")
            created += 1

        db.commit()
        print(f"\n{linked} linked, {costed} costs updated, {created} items created")
    finally:
        db.close()


if __name__ == "__main__":
    main()
