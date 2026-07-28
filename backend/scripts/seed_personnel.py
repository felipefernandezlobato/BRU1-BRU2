"""Seed historical personnel cost records for Feb-Jun 2026."""
import os
import sys

# Allow running from project root or scripts directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.database import Base
from app.models import PersonnelCost

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./data/movements.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

RECORDS = [
    {
        "year": 2026, "month": 2,
        "total_paid": 35370.00,
        "bru1_e2n": 32515.90,
        "bru2_e2n": 7344.42,
        "notes": "FEBRERO - historical import",
    },
    {
        "year": 2026, "month": 3,
        "total_paid": 44410.00,
        "bru1_e2n": 37962.22,
        "bru2_e2n": 13703.63,
        "notes": "MARZO - historical import",
    },
    {
        "year": 2026, "month": 4,
        "total_paid": 44591.00,
        "bru1_e2n": 33917.87,
        "bru2_e2n": 13901.41,
        "notes": "ABRIL - historical import",
    },
    {
        "year": 2026, "month": 5,
        "total_paid": 42273.00,
        "bru1_e2n": 34969.83,
        "bru2_e2n": 14691.93,
        "notes": "MAYO - historical import",
    },
    {
        "year": 2026, "month": 6,
        "total_paid": 45056.00,
        "bru1_e2n": 44757.00,
        "bru2_e2n": 13731.00,
        "notes": "JUNIO - historical import",
    },
]


def seed():
    db = SessionLocal()
    try:
        inserted = 0
        updated = 0
        for rec in RECORDS:
            total_e2n = rec["bru1_e2n"] + rec["bru2_e2n"]
            ratio = rec["bru2_e2n"] / total_e2n
            bru2_cost = rec["total_paid"] * ratio

            existing = (
                db.query(PersonnelCost)
                .filter(
                    PersonnelCost.year == rec["year"],
                    PersonnelCost.month == rec["month"],
                )
                .first()
            )

            if existing:
                existing.total_paid = rec["total_paid"]
                existing.bru1_e2n = rec["bru1_e2n"]
                existing.bru2_e2n = rec["bru2_e2n"]
                existing.ratio = round(ratio, 6)
                existing.bru2_cost = round(bru2_cost, 2)
                existing.notes = rec["notes"]
                updated += 1
                print(f"  Updated {rec['year']}-{rec['month']:02d}: ratio={ratio:.4f}, bru2_cost=CHF {bru2_cost:.2f}")
            else:
                record = PersonnelCost(
                    year=rec["year"],
                    month=rec["month"],
                    total_paid=rec["total_paid"],
                    bru1_e2n=rec["bru1_e2n"],
                    bru2_e2n=rec["bru2_e2n"],
                    ratio=round(ratio, 6),
                    bru2_cost=round(bru2_cost, 2),
                    notes=rec["notes"],
                )
                db.add(record)
                inserted += 1
                print(f"  Inserted {rec['year']}-{rec['month']:02d}: ratio={ratio:.4f}, bru2_cost=CHF {bru2_cost:.2f}")

        db.commit()
        print(f"\nDone: {inserted} inserted, {updated} updated.")
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding personnel cost records...")
    seed()
