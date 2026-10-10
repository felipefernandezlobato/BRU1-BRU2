#!/usr/bin/env python3
"""Create the Setting rows backing the fixed monthly BRU2 costs.

Three rows per cost — amount / active / estimado — as defined by FIXED_COSTS in
app/services/fixed_costs.py:

    Utilities           850.00  activo, confirmado
    Sunrise              50.00  activo, estimado   (25 if Benji pays, unresolved)
    Lightspeed          140.00  activo, confirmado
    Transporte Sergio   700.00  activo, estimado
    -------------------------------------------
    TOTAL              1740.00 CHF/month

These have to exist as rows before the admin Ajustes page can edit them, because
PUT /api/settings/{key} updates but never creates.

Idempotent: existing keys are left untouched, so a second run reporting
"0 created" is the proof the first one landed. Run against production with:

    DATABASE_URL='<neon-url>' python scripts/add_fixed_cost_settings.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Setting
from app.services.fixed_costs import FIXED_COSTS, setting_keys


def main():
    db = SessionLocal()
    created = 0
    skipped = 0
    try:
        for slug, label, amount, estimado in FIXED_COSTS:
            amount_key, active_key, estimado_key = setting_keys(slug)
            rows = [
                (amount_key, f"{amount:.2f}"),
                (active_key, "true"),
                (estimado_key, "true" if estimado else "false"),
            ]
            for key, value in rows:
                existing = db.query(Setting).filter(Setting.key == key).first()
                if existing:
                    print(f"  skip   {key} = {existing.value} (already set)")
                    skipped += 1
                    continue
                db.add(Setting(key=key, value=value))
                print(f"  create {key} = {value}")
                created += 1
            print(f"  -> {label}: {amount:.2f} CHF/month"
                  f"{' (estimado)' if estimado else ''}")
        db.commit()
        print(f"\n{created} created, {skipped} skipped")
    finally:
        db.close()


if __name__ == "__main__":
    main()
