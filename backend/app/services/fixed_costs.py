"""Fixed monthly BRU2 operating costs (utilities, Sunrise, Lightspeed, transport).

Each cost is backed by three Setting rows — amount, active, estimado — so the
admin UI can edit them without a schema change. FIXED_COSTS below is the single
definition the API and the frontend both iterate: adding a cost means one entry
here plus a seed row, not a migration.

Costs that are not yet confirmed (Sunrise depends on who pays, Sergio's
transport is still an estimate) carry an `estimado` flag so analytics can show
the confirmed and estimated shares apart.

The settings are read once into a plain dict by load_settings() and every other
function here is pure, so building a 12-month series costs one query rather
than one per cost per month.
"""
from sqlalchemy.orm import Session

from app.models import Setting

# BRU2 opened 2026-02-16, so February carries half a month of fixed costs.
OPEN_YEAR, OPEN_MONTH = 2026, 2

# (slug, Spanish label, default amount CHF/month, default estimado)
FIXED_COSTS: list[tuple[str, str, float, bool]] = [
    ("utilities", "Utilities", 850.0, False),
    ("sunrise", "Sunrise", 50.0, True),
    ("lightspeed", "Lightspeed", 140.0, False),
    ("transporte_sergio", "Transporte Sergio", 700.0, True),
]


def setting_keys(slug: str) -> tuple[str, str, str]:
    """The three Setting keys backing one fixed cost."""
    return f"cost_{slug}_amount", f"cost_{slug}_active", f"cost_{slug}_estimado"


def load_settings(db: Session) -> dict[str, str]:
    """All settings as a key -> value map, so callers query once."""
    return {s.key: s.value for s in db.query(Setting).all()}


def _as_float(value: str | None, default: float) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in ("1", "true", "t", "yes", "si")


def month_open_factor(year: int, month: int) -> float:
    """Share of a full month's fixed cost that applies to the given month.

    0.0 before BRU2 opened, 0.5 for the opening month, 1.0 after. Rent and the
    other fixed costs share this so the two cannot drift apart.
    """
    if year < OPEN_YEAR or (year == OPEN_YEAR and month < OPEN_MONTH):
        return 0.0
    if year == OPEN_YEAR and month == OPEN_MONTH:
        return 0.5
    return 1.0


def get_monthly_rent(settings: dict[str, str]) -> float:
    return _as_float(settings.get("monthly_rent"), 0.0)


def get_fixed_costs(settings: dict[str, str]) -> list[dict]:
    """Every defined fixed cost with its stored amount and flags.

    Falls back to the defaults in FIXED_COSTS when a key is missing, so a DB
    that has not been seeded yet still reports sensible figures instead of zero.
    """
    costs = []
    for slug, label, default_amount, default_estimado in FIXED_COSTS:
        amount_key, active_key, estimado_key = setting_keys(slug)
        costs.append(
            {
                "slug": slug,
                "label": label,
                "amount": _as_float(settings.get(amount_key), default_amount),
                "active": _as_bool(settings.get(active_key), True),
                "estimado": _as_bool(settings.get(estimado_key), default_estimado),
            }
        )
    return costs


def fixed_costs_for_month(settings: dict[str, str], year: int, month: int) -> dict:
    """Active fixed costs prorated for one month, plus the per-cost breakdown."""
    factor = month_open_factor(year, month)
    items = []
    total = 0.0
    for cost in get_fixed_costs(settings):
        if not cost["active"]:
            continue
        amount = round(cost["amount"] * factor, 2)
        total += amount
        items.append(
            {
                "slug": cost["slug"],
                "label": cost["label"],
                "amount": amount,
                "estimado": cost["estimado"],
            }
        )
    return {"total": round(total, 2), "items": items}
