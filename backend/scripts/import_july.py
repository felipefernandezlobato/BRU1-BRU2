#!/usr/bin/env python3
"""Import July 2026 movement data into the database.

Supplements the main import_historical.py script (which covers Feb-June 2026)
by adding all July 2026 movements (rows from 02.Juli.2026 through 27.Juli.2026).

The data is embedded directly -- no external file dependency at runtime.
Idempotent: skips dates that already have a movement.
"""
import os
import sys
from datetime import datetime, date
from collections import defaultdict

# Add parent dir to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Category, Item, Movement, MovementLine, User

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MARKUP_PCT = 30.0  # matches the DB setting

# ---------------------------------------------------------------------------
# Category mapping: raw spreadsheet name -> clean display name
# (Same as import_historical.py)
# ---------------------------------------------------------------------------
CATEGORY_MAP = {
    "cafe matcha chai choc": "Cafe & Te",
    "tartas": "Reposteria",
    "milk": "Lacteos",
    "bowl": "Bowls",
    "sandwich": "Sandwiches",
    "bagel": "Bagels",
    "Drinks Beer": "Cerveza",
    "Drinks Soft drinks": "Refrescos",
    "Drinks Wine": "Vinos",
    "retail": "Retail",
    "tazas": "Tazas & Loza",
    "consumibles": "Consumibles",
    "no consumibles": "No Consumibles",
    "no consumible": "No Consumibles",
    "take away": "Take Away",
    "fruta": "Fruta",
    "Sirope": "Siropes",
    "varios": "Varios",
    "varios ": "Varios",
}

# ---------------------------------------------------------------------------
# Item name normalization (same as import_historical.py)
# ---------------------------------------------------------------------------
ITEM_NAME_MAP = {
    # Bagels
    "begels de salmon": "Bagel de salmon",
    "Begels de salmón": "Bagel de salmon",
    "begels de salmón": "Bagel de salmon",
    "Begel York": "Bagel York",
    "begels de atún": "Bagel de atun",
    # Baked goods
    "banana bread": "Banana bread",
    "Banana Bread": "Banana bread",
    "brownies": "Brownies",
    "croissant": "Croissant",
    "pain au chocolat": "Pain au chocolat",
    # Bowls
    "bowl yogurt": "Bowl yogurt",
    "Bowl yogurt": "Bowl yogurt",
    "Bowl chia": "Bowl chia",
    # Sandwiches
    "sándwich pollo": "Sandwich pollo",
    "sándwich atún": "Sandwich atun",
    # Milk
    "leche normal": "Leche entera",
    "leche Avena": "Leche de avena",
    "leche sin lactosa": "Leche sin lactosa",
    # July-specific variants
    "leche normal (6L)": "Leche entera",
    # Ensaladas
    "ensaladas cesar": "Ensalada cesar",
    "ensaldas mediterranea": "Ensalada mediterranea",
}

# Categories whose items are "produced" (made in BRU1 kitchen)
PRODUCED_CATEGORIES_RAW = {"tartas", "sandwich", "bagel", "bowl"}

# Individual items that are produced regardless of category
PRODUCED_ITEMS = {"Pure de fresa"}


def normalize_item_name(raw_name: str, raw_category: str) -> str:
    """Normalize an item name to a canonical form."""
    name = raw_name.strip()

    # Check direct mapping first
    if name in ITEM_NAME_MAP:
        return ITEM_NAME_MAP[name]

    # Strip "Drinks " prefix (redundant with category)
    if name.startswith("Drinks "):
        name = name[7:].strip()

    # Strip "take away " prefix (redundant with category)
    if name.startswith("take away "):
        name = name[10:].strip()

    # Normalize "cafe" -> "Cafe" in coffee item names
    if name.startswith("cafe "):
        name = "Cafe " + name[5:]

    # Strip "Sirope " prefix if category is already Siropes
    if raw_category.strip().lower() == "sirope" and name.startswith("Sirope "):
        name = name[7:].strip()
        if name:
            name = name[0].upper() + name[1:]

    return name


def is_produced(raw_category: str, item_name: str) -> bool:
    """Determine if an item is produced (made in BRU1 kitchen)."""
    cat = raw_category.strip().lower()
    if cat in PRODUCED_CATEGORIES_RAW:
        return True
    if item_name in PRODUCED_ITEMS:
        return True
    return False


def parse_cost(valor: str) -> float:
    """Parse a CHF cost string like 'CHF 2.55' -> 2.55."""
    if not valor or not valor.strip():
        return 0.0
    s = valor.strip()
    s = s.replace("CHF", "").strip()
    s = s.replace("'", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


# ---------------------------------------------------------------------------
# German month names for date parsing
# ---------------------------------------------------------------------------
GERMAN_MONTHS = {
    "Januar": 1, "Februar": 2, "März": 3, "April": 4,
    "Mai": 5, "Juni": 6, "Juli": 7, "August": 8,
    "September": 9, "Oktober": 10, "November": 11, "Dezember": 12,
}


def parse_german_date(s: str) -> date:
    """Parse '02.Juli.2026' -> date(2026, 7, 2)."""
    parts = s.strip().split(".")
    day = int(parts[0])
    month = GERMAN_MONTHS[parts[1]]
    year = int(parts[2])
    return date(year, month, day)


# ---------------------------------------------------------------------------
# Embedded July 2026 data (TSV: date, raw_category, raw_item, qty, cost_per_unit, total)
# ---------------------------------------------------------------------------
JULY_DATA = """\
02.Juli.2026	tartas	Carrot cake	4	CHF 0.64	CHF 2.55
02.Juli.2026	tartas	brownies	4	CHF 0.69	CHF 2.76
02.Juli.2026	tartas	Lemon cake	6	CHF 0.60	CHF 3.59
02.Juli.2026	tartas	Banana bread	6	CHF 0.70	CHF 4.21
02.Juli.2026	no consumibles	Bayetas microfibras negros	1
02.Juli.2026	no consumibles	Bayetas microfibras azules	1
02.Juli.2026	no consumibles	Bayetas microfibras marrones	1
02.Juli.2026	bowl	Bowl yogurt	1	CHF 3.00	CHF 3.00
02.Juli.2026	milk	leche Avena	4	CHF 2.75	CHF 11.00
02.Juli.2026	milk	leche normal	5	CHF 1.50	CHF 7.50
02.Juli.2026	tartas	croissant	12	CHF 2.90	CHF 34.80
02.Juli.2026	take away	take away vasos transparentes	100	CHF 0.11	CHF 11.00
02.Juli.2026	take away	take away tapas	200	CHF 0.03	CHF 6.00
02.Juli.2026	no consumibles	Camisetas USO PERSONAL M, L	2
02.Juli.2026	milk	leche normal	4	CHF 1.50	CHF 6.00
02.Juli.2026	milk	leche Avena	1	CHF 2.75	CHF 2.75
02.Juli.2026	tartas	Cinnamon rolls	2	CHF 0.90	CHF 1.79
02.Juli.2026	bowl	Bowl yogurt	2	CHF 3.00	CHF 6.00
02.Juli.2026	bowl	Bowl chia	2	CHF 3.00	CHF 6.00
03.Juli.2026	take away	take away Vasos rojos	37	CHF 0.22	CHF 8.14
03.Juli.2026	milk	leche normal	6	CHF 1.50	CHF 9.00
03.Juli.2026	milk	leche Avena	2	CHF 2.75	CHF 5.50
03.Juli.2026	bowl	Bowl yogurt	2	CHF 3.00	CHF 6.00
03.Juli.2026	bowl	Bowl chia	1	CHF 3.00	CHF 3.00
06.Juli.2026	tartas	Lemon cake	6	CHF 0.60	CHF 3.59
06.Juli.2026	tartas	brownies	3	CHF 0.69	CHF 2.07
06.Juli.2026	tartas	Banana bread	6	CHF 0.70	CHF 4.21
06.Juli.2026	tartas	Cinnamon rolls	6	CHF 0.90	CHF 5.38
06.Juli.2026	tartas	croissant	24	CHF 2.90	CHF 69.60
06.Juli.2026	no consumibles	Bayetas microfibras negras	3
06.Juli.2026	no consumibles	Bayetas microfibras marrones	1
06.Juli.2026	no consumibles	Bayetas microfibras azul	2
06.Juli.2026	no consumibles	Camisetas USO PERSONAL	1
06.Juli.2026	fruta	Limas (jugo)	1
06.Juli.2026	tartas	Carrot icing	1	CHF 5.38	CHF 5.38
06.Juli.2026	milk	leche normal	4	CHF 1.50	CHF 6.00
06.Juli.2026	milk	leche Avena	2	CHF 2.75	CHF 5.50
06.Juli.2026	milk	leche sin lactosa	3	CHF 2.20	CHF 6.60
06.Juli.2026	cafe matcha chai choc	Chocolate Garçoa	1	CHF 43.00	CHF 43.00
07.Juli.2026	no consumibles	Camisetas USO PERSONAL	4
07.Juli.2026	cafe matcha chai choc	cafe 1kg Rwanda Mahembe	3
07.Juli.2026	cafe matcha chai choc	cafe 1kg Rwanda Karongi	3
07.Juli.2026	bowl	Bowl yogurt	2	CHF 3.00	CHF 6.00
07.Juli.2026	bowl	Bowl chia	2	CHF 3.00	CHF 6.00
07.Juli.2026	tartas	brownies	4	CHF 0.69	CHF 2.76
07.Juli.2026	tartas	Cinnamon rolls	3	CHF 0.90	CHF 2.69
07.Juli.2026	milk	leche normal	3	CHF 1.50	CHF 4.50
07.Juli.2026	milk	leche Avena	3	CHF 2.75	CHF 8.25
08.Juli.2026	Drinks Soft drinks	Drinks Agua San pellegrino	12	CHF 1.11	CHF 13.32
08.Juli.2026	Drinks Soft drinks	Drinks Agua San pellegrino	20	CHF 1.11	CHF 22.20
08.Juli.2026	milk	leche normal	6	CHF 1.50	CHF 9.00
08.Juli.2026	milk	leche Avena	3	CHF 2.75	CHF 8.25
08.Juli.2026	tartas	Carrot icing	1	CHF 5.38	CHF 5.38
08.Juli.2026	fruta	Pure de fresa	1
08.Juli.2026	tartas	Lemon cake	6	CHF 0.60	CHF 3.59
08.Juli.2026	tartas	Cinnamon rolls	1	CHF 0.90	CHF 0.90
09.Juli.2026	no consumibles	Camisetas USO PERSONAL M, L, XL	3
09.Juli.2026	take away	take away vasos transparentes	100	CHF 0.11	CHF 11.00
09.Juli.2026	take away	take away Vaso	50	CHF 0.08	CHF 4.00
09.Juli.2026	tartas	Banana bread	4	CHF 0.70	CHF 2.81
09.Juli.2026	milk	leche normal	6	CHF 1.50	CHF 9.00
09.Juli.2026	milk	leche Avena	4	CHF 2.75	CHF 11.00
09.Juli.2026	cafe matcha chai choc	cafe 1kg Café descafeinado	1	CHF 21.78	CHF 21.78
09.Juli.2026	bowl	Bowl chia	2	CHF 3.00	CHF 6.00
09.Juli.2026	tartas	Cinnamon rolls	2	CHF 0.90	CHF 1.79
10.Juli.2026	tartas	croissant	14	CHF 2.90	CHF 40.60
10.Juli.2026	fruta	Limas	1
10.Juli.2026	fruta	Naranja - 1 	1	CHF 1.85	CHF 1.85
10.Juli.2026	tartas	Banana bread	1	CHF 0.70	CHF 0.70
10.Juli.2026	tartas	Lemon cake	2	CHF 0.60	CHF 3.59
10.Juli.2026	tartas	Cinnamon rolls	1	CHF 0.90	CHF 0.90
10.Juli.2026	milk	leche normal	6	CHF 1.50	CHF 9.00
10.Juli.2026	bowl	Bowl yogurt	1	CHF 3.00	CHF 3.00
10.Juli.2026	consumibles	Azúcar monodosis (840g)	1		CHF 0.00
10.Juli.2026	consumibles	Servilletas pequeñas	1
10.Juli.2026	consumibles	pajitas bolsa	2
13.Juli.2026	tartas	brownies	3	CHF 0.69	CHF 2.07
13.Juli.2026	tartas	Banana bread	5	CHF 0.70	CHF 3.51
13.Juli.2026	tartas	Lemon cake	5	CHF 0.60	CHF 3.59
13.Juli.2026	tartas	Cookies	3	CHF 1.00	CHF 3.00
13.Juli.2026	milk	leche Avena	5	CHF 2.75	CHF 13.75
13.Juli.2026	milk	leche normal	2	CHF 1.50	CHF 3.00
13.Juli.2026	milk	leche sin lactosa	2	CHF 2.20	CHF 4.40
13.Juli.2026	take away	take away Vaso	3	CHF 11.00	CHF 33.00
13.Juli.2026	take away	take away vasos transparentes	100	CHF 0.11	CHF 11.00
13.Juli.2026	fruta	pepino	1	CHF 1.10	CHF 1.10
13.Juli.2026	no consumibles	Bayetas microfibras negras	1
13.Juli.2026	no consumibles	Bayetas microfibras azules	1
14.Juli.2026	cafe matcha chai choc	cafe 1kg Rwanda Mahembe	1
14.Juli.2026	no consumibles	Camisetas USO PERSONAL	4
14.Juli.2026	milk	leche Avena	5	CHF 2.75	CHF 13.75
14.Juli.2026	bowl	Bowl chia	2	CHF 3.00	CHF 6.00
14.Juli.2026	bowl	Bowl yogurt	2	CHF 3.00	CHF 6.00
14.Juli.2026	tartas	Banana bread	4	CHF 0.70	CHF 2.81
15.Juli.2026	bowl	Bowl chia	2	CHF 3.00	CHF 6.00
15.Juli.2026	bowl	Bowl yogurt	2	CHF 3.00	CHF 6.00
15.Juli.2026	tartas	brownies	3	CHF 0.69	CHF 2.07
15.Juli.2026	tartas	Banana bread	1	CHF 0.70	CHF 0.70
15.Juli.2026	tartas	Cookies	4	CHF 1.00	CHF 4.00
15.Juli.2026	milk	leche Avena	5	CHF 2.75	CHF 13.75
15.Juli.2026	milk	leche normal	7	CHF 1.50	CHF 10.50
15.Juli.2026	no consumibles	Camisetas USO PERSONAL	3
15.Juli.2026	no consumibles	Bayetas trapos azules	2
15.Juli.2026	no consumibles	Bayetas trapos negros	8
15.Juli.2026	no consumibles	Bayetas trapos marrones	2
16.Juli.2026	tartas	Cinnamon rolls	4	CHF 0.90	CHF 3.59
16.Juli.2026	tartas	Lemon cake	4	CHF 0.60	CHF 3.59
16.Juli.2026	no consumibles	Camisetas USO PERSONAL	1
16.Juli.2026	milk	leche normal	4	CHF 1.50	CHF 6.00
16.Juli.2026	milk	leche Avena	3	CHF 2.75	CHF 8.25
16.Juli.2026	consumibles	Bolsas de basura 110L negra	1	CHF 2.50	CHF 2.50
16.Juli.2026	tartas	Cookies	2	CHF 1.00	CHF 2.00
16.Juli.2026	tartas	Banana bread	4	CHF 0.70	CHF 2.81
16.Juli.2026	tartas	brownies	2	CHF 0.69	CHF 1.38
16.Juli.2026	cafe matcha chai choc	cafe 1kg Ethiopia by dabov	4	CHF 23.00	CHF 92.00
16.Juli.2026	cafe matcha chai choc	cafe 200g Ruanda Mahembe	4	CHF 5.08	CHF 20.32
16.Juli.2026	tartas	croissant	24	CHF 2.90	CHF 69.60
17.Juli.2026	milk	leche normal	7	CHF 1.50	CHF 10.50
17.Juli.2026	milk	leche Avena	2	CHF 2.75	CHF 5.50
17.Juli.2026	milk	leche sin lactosa	1	CHF 2.20	CHF 2.20
17.Juli.2026	bowl	Bowl chia	1	CHF 3.00	CHF 3.00
17.Juli.2026	tartas	brownies	2	CHF 0.69	CHF 1.38
17.Juli.2026	tartas	Lemon cake	1	CHF 0.60	CHF 3.59
17.Juli.2026	tartas	Cookies	3	CHF 1.00	CHF 3.00
17.Juli.2026	no consumibles	Bayetas microfibras marrones	1
17.Juli.2026	no consumibles	Bayetas microfibras negros	1
17.Juli.2026	no consumibles	Bayetas microfibras blancas	1
17.Juli.2026	cafe matcha chai choc	cafe 1kg Café descafeinado	1	CHF 21.50	CHF 21.50
17.Juli.2026	fruta	Limas (586 gr)	1
17.Juli.2026	tartas	Carrot icing	1	CHF 5.38	CHF 5.38
18.Juli.2026	no consumible	Rallador para Montblanc	1
18.Juli.2026	Drinks Beer	Espuma fría Montblanc (540 gr)	1
18.Juli.2026	consumibles	Filtros para cerveza fría grandes	5
18.Juli.2026	bowl	Bowl yogurt	1	CHF 3.00	CHF 3.00
18.Juli.2026	bowl	Bowl chia	1	CHF 3.00	CHF 3.00
18.Juli.2026	tartas	brownies	2	CHF 0.69	CHF 1.38
18.Juli.2026	consumibles	pajitas bolsa (200 unidades)	200
18.Juli.2026	cafe matcha chai choc	Chai 1kg	1	CHF 28.00	CHF 28.00
18.Juli.2026	no consumibles	Camisetas USO PERSONAL	3
18.Juli.2026	no consumibles	Bayetas trapos negros	6
18.Juli.2026	no consumibles	Bayetas trapos marrones	2
18.Juli.2026	no consumibles	Bayetas trapos blancos	5
21.Juli.2026	tazas	LOGO CUPS Tazas	4	CHF 0.00	CHF 0.00
21.Juli.2026	no consumibles	Bayetas microfibras negras	1
21.Juli.2026	tartas	Banana bread	1	CHF 0.70	CHF 0.70
21.Juli.2026	tartas	Cinnamon rolls	4	CHF 0.90	CHF 3.59
21.Juli.2026	tartas	Cookies	4	CHF 1.00	CHF 4.00
21.Juli.2026	tartas	brownies	4	CHF 0.69	CHF 2.76
21.Juli.2026	bowl	Bowl chia	1	CHF 3.00	CHF 3.00
21.Juli.2026	bowl	Bowl yogurt	1	CHF 3.00	CHF 3.00
21.Juli.2026	tartas	croissant	5	CHF 2.90	CHF 14.50
21.Juli.2026	milk	leche normal	4	CHF 1.50	CHF 6.00
21.Juli.2026	milk	leche Avena	4	CHF 2.75	CHF 11.00
22.Juli.2026	tartas	croissant	5	CHF 2.90	CHF 14.50
22.Juli.2026	tartas	brownies	3	CHF 0.69	CHF 2.07
22.Juli.2026	tartas	Banana bread	6	CHF 0.70	CHF 4.21
22.Juli.2026	tartas	Lemon cake	6	CHF 0.60	CHF 3.59
22.Juli.2026	tartas	Cookies	6	CHF 1.00	CHF 6.01
22.Juli.2026	milk	leche normal	4	CHF 1.50	CHF 6.00
22.Juli.2026	milk	leche Avena	4	CHF 2.75	CHF 11.00
22.Juli.2026	milk	leche sin lactosa	3	CHF 2.20	CHF 6.60
22.Juli.2026	no consumibles	Bayetas microfibra negra	1
22.Juli.2026	no consumibles	Bayetas microfibra marrón	1
22.Juli.2026	no consumibles	Bayetas toallas	1
22.Juli.2026	tartas	Cinnamon rolls	4	CHF 0.90	CHF 3.59
22.Juli.2026	fruta	Pure de fresa	1
23.Juli.2026	Drinks Beer	Drinks Cerveza Barriles Cerveza	1	CHF 60.00	CHF 60.00
23.Juli.2026	Drinks Soft drinks	Coldbrew (2L)	1
23.Juli.2026	no consumible	Rallador para Montblanc	1
23.Juli.2026	sandwich	sándwich bru2	1
23.Juli.2026	no consumibles	Bayetas trapos negros y blancos	4
23.Juli.2026	no consumibles	Bayetas trapos azules	1
23.Juli.2026	no consumibles	Bayetas trapos marrones	1
23.Juli.2026	milk	leche normal (6L)	6	CHF 1.50	CHF 9.00
23.Juli.2026	varios	Espuma fría Montblanc (540 gr)	1
23.Juli.2026	Sirope	Sirope arce	1	CHF 22.54	CHF 22.54
23.Juli.2026	no consumibles	Camisetas USO PERSONAL	3
25.Juli.2026	tartas	brownies	4	CHF 0.69	CHF 2.76
25.Juli.2026	tartas	Cookies	5	CHF 1.00	CHF 5.01
25.Juli.2026	milk	leche normal	6	CHF 1.50	CHF 9.00
25.Juli.2026	milk	leche Avena	4	CHF 2.75	CHF 11.00
25.Juli.2026	milk	leche sin lactosa	2	CHF 2.20	CHF 4.40
25.Juli.2026	no consumibles	Bayetas microfibra negra	1
25.Juli.2026	Drinks Wine	Drinks Wine Prosecco Frizzante	12
27.Juli.2026	milk	leche normal	5	CHF 1.50	CHF 7.50
27.Juli.2026	milk	leche Avena	1	CHF 2.75	CHF 2.75
27.Juli.2026	tartas	croissant	16	CHF 2.90	CHF 46.40
"""


def parse_data_rows() -> list[dict]:
    """Parse the embedded TSV data into structured dicts."""
    rows = []
    for line in JULY_DATA.strip().splitlines():
        parts = line.split("\t")
        if len(parts) < 4:
            continue

        date_str = parts[0].strip()
        raw_category = parts[1].strip()
        raw_item = parts[2].strip()
        qty_str = parts[3].strip()

        # Parse quantity
        try:
            qty = float(qty_str)
        except ValueError:
            continue
        if qty == 0:
            continue

        # Parse cost per unit (column 4, may be empty)
        cost_per_unit = 0.0
        if len(parts) > 4 and parts[4].strip():
            cost_per_unit = parse_cost(parts[4])

        # Parse date
        mv_date = parse_german_date(date_str)

        rows.append({
            "date": mv_date,
            "raw_category": raw_category,
            "raw_item": raw_item,
            "qty": qty,
            "cost_per_unit": cost_per_unit,
        })

    return rows


def main():
    print("=" * 60)
    print("IMPORT JULY 2026 MOVEMENTS")
    print("=" * 60)
    print()

    # -----------------------------------------------------------------------
    # 1. Parse embedded data
    # -----------------------------------------------------------------------
    raw_rows = parse_data_rows()
    print(f"Parsed {len(raw_rows)} data rows from embedded July data")

    # -----------------------------------------------------------------------
    # 2. Normalize and group by date
    # -----------------------------------------------------------------------
    # item_key = (clean_category, clean_item_name)
    items_info: dict[tuple[str, str], dict] = {}
    movements_by_date: dict = defaultdict(list)

    for row in raw_rows:
        raw_cat = row["raw_category"]
        raw_item = row["raw_item"]

        # Map category
        clean_cat = CATEGORY_MAP.get(raw_cat, CATEGORY_MAP.get(raw_cat.strip(), raw_cat))

        # Normalize item name
        clean_item = normalize_item_name(raw_item, raw_cat)
        produced = is_produced(raw_cat, clean_item)

        item_key = (clean_cat, clean_item)
        cost = row["cost_per_unit"]

        if item_key not in items_info:
            items_info[item_key] = {
                "name": clean_item,
                "category": clean_cat,
                "cost": cost,
                "is_produced": produced,
            }
        elif cost > 0:
            items_info[item_key]["cost"] = cost

        movements_by_date[row["date"]].append({
            "item_key": item_key,
            "qty": row["qty"],
            "cost_per_unit": cost,
        })

    unique_dates = sorted(movements_by_date.keys())
    print(f"Unique items referenced: {len(items_info)}")
    print(f"Unique dates: {len(unique_dates)}")
    print(f"Date range: {unique_dates[0]} to {unique_dates[-1]}")
    print()

    # -----------------------------------------------------------------------
    # 3. Write to database
    # -----------------------------------------------------------------------
    db = SessionLocal()
    try:
        # --- Get admin user ---
        admin = db.query(User).filter(User.role == "admin").first()
        if not admin:
            print("ERROR: No admin user found. Run the historical import first.")
            sys.exit(1)
        admin_id = admin.id
        print(f"Using admin user: {admin.name} (id={admin_id})")

        # --- Check for existing July movements (idempotency) ---
        existing_july = (
            db.query(Movement)
            .filter(Movement.movement_date >= "2026-07-01")
            .filter(Movement.movement_date <= "2026-07-31")
            .all()
        )
        existing_dates = {m.movement_date for m in existing_july}
        if existing_dates:
            print(f"WARNING: Found {len(existing_dates)} existing July movement(s):")
            for d in sorted(existing_dates):
                print(f"  {d} (will be skipped)")
            print()

        # --- Build category lookup ---
        all_categories = db.query(Category).all()
        cat_by_name: dict[str, Category] = {c.name: c for c in all_categories}

        # --- Build item lookup ---
        all_items = db.query(Item).all()
        item_by_key: dict[tuple[str, str], Item] = {}
        for item in all_items:
            cat_name = cat_by_name_reverse(item.category_id, all_categories)
            if cat_name:
                item_by_key[(cat_name, item.name)] = item

        # --- Ensure categories and items exist ---
        new_categories = 0
        new_items = 0

        for item_key, info in items_info.items():
            cat_name, item_name = item_key

            # Create category if needed
            if cat_name not in cat_by_name:
                max_pos = max((c.position for c in cat_by_name.values()), default=0)
                cat = Category(name=cat_name, position=max_pos + 1, is_active=True)
                db.add(cat)
                db.flush()
                cat_by_name[cat_name] = cat
                new_categories += 1
                print(f"  Created category: {cat_name} (id={cat.id})")

            # Find or create item
            if item_key not in item_by_key:
                cat_obj = cat_by_name[cat_name]
                item = Item(
                    name=item_name,
                    category_id=cat_obj.id,
                    unit="ud",
                    cost_per_unit=info["cost"],
                    is_produced=info["is_produced"],
                    is_active=True,
                )
                db.add(item)
                db.flush()
                item_by_key[item_key] = item
                new_items += 1

        if new_categories:
            print(f"  Created {new_categories} new categories")
        if new_items:
            print(f"  Created {new_items} new items")
        print()

        # --- Create movements ---
        print("Creating movements...")
        movements_created = 0
        total_lines = 0
        total_cost = 0.0
        skipped_dates = 0

        for mv_date in unique_dates:
            date_str = mv_date.strftime("%Y-%m-%d")

            # Skip if already exists
            if date_str in existing_dates:
                skipped_dates += 1
                continue

            lines_data = movements_by_date[mv_date]

            movement = Movement(
                direction="BRU1_TO_BRU2",
                created_by=admin_id,
                notes=f"Historical import: {date_str}",
                movement_date=date_str,
            )
            db.add(movement)
            db.flush()

            for line_data in lines_data:
                item_key = line_data["item_key"]
                item_obj = item_by_key[item_key]
                cost = line_data["cost_per_unit"]
                qty = line_data["qty"]

                # Calculate transfer price
                if item_obj.is_produced:
                    transfer_price = round(cost * (1 + MARKUP_PCT / 100), 4)
                    markup = MARKUP_PCT
                else:
                    transfer_price = cost
                    markup = 0.0

                ml = MovementLine(
                    movement_id=movement.id,
                    item_id=item_obj.id,
                    quantity=qty,
                    unit=item_obj.unit,
                    cost_per_unit_snapshot=cost,
                    markup_pct_snapshot=markup,
                    transfer_price_snapshot=transfer_price,
                )
                db.add(ml)
                total_lines += 1
                total_cost += transfer_price * qty

            db.flush()
            movements_created += 1

        # --- Commit ---
        db.commit()

        print()
        print("=" * 60)
        print("JULY IMPORT COMPLETE")
        print("=" * 60)
        print(f"  New categories created: {new_categories}")
        print(f"  New items created:      {new_items}")
        print(f"  Movements created:      {movements_created}")
        if skipped_dates:
            print(f"  Movements skipped:      {skipped_dates} (already existed)")
        print(f"  Movement lines:         {total_lines}")
        print(f"  Total cost (transfer):  CHF {total_cost:,.2f}")
        if unique_dates:
            print(f"  Date range:             {unique_dates[0]} to {unique_dates[-1]}")

    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


def cat_by_name_reverse(category_id: int, all_categories: list) -> str | None:
    """Get category name by ID from the loaded list."""
    for c in all_categories:
        if c.id == category_id:
            return c.name
    return None


if __name__ == "__main__":
    main()
