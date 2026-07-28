from sqlalchemy.orm import Session

from app.auth import hash_pin
from app.models import User, Setting


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

    db.commit()
