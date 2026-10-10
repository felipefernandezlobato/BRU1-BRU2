from sqlalchemy.orm import Session

from app.auth import hash_pin
from app.models import User, Setting
from app.services.fixed_costs import FIXED_COSTS, setting_keys


def seed_data(db: Session):
    """Idempotent seed — only runs if no users exist."""
    existing = db.query(User).first()
    if existing:
        return

    # Default admin user
    admin = User(
        name="Admin",
        pin_hash=hash_pin("0000"),
        role="admin",
    )
    db.add(admin)

    # Default settings
    db.add(Setting(key="markup_pct", value="30"))
    db.add(Setting(key="escandallos_api_url", value="https://bru-escandallos-api.onrender.com"))

    # Fixed monthly BRU2 costs — three rows each (amount / active / estimado).
    # PUT /api/settings/{key} only updates existing rows, so the keys have to
    # exist before the admin UI can edit them.
    for slug, _label, amount, estimado in FIXED_COSTS:
        amount_key, active_key, estimado_key = setting_keys(slug)
        db.add(Setting(key=amount_key, value=f"{amount:.2f}"))
        db.add(Setting(key=active_key, value="true"))
        db.add(Setting(key=estimado_key, value="true" if estimado else "false"))

    db.commit()
