from datetime import date, datetime
import calendar

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Movement, MovementLine, Item, Category


def get_month_range(year: int, month: int) -> tuple[str, str]:
    """Return (start_date_str, end_date_str) for a given year/month."""
    first_day = date(year, month, 1)
    last_day_num = calendar.monthrange(year, month)[1]
    last_day = date(year, month, last_day_num)
    return first_day.isoformat(), last_day.isoformat()


def monthly_summary(db: Session, year: int, month: int) -> dict:
    """Return total_cost and count for a given month."""
    start, end = get_month_range(year, month)
    result = (
        db.query(
            func.coalesce(
                func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity), 0
            ).label("total_cost"),
            func.count(func.distinct(Movement.id)).label("count"),
        )
        .join(Movement, MovementLine.movement_id == Movement.id)
        .filter(Movement.movement_date >= start, Movement.movement_date <= end)
        .first()
    )
    return {"total_cost": float(result.total_cost), "count": result.count}


def top_items_by_cost(db: Session, start: str, end: str, limit: int = 5) -> list[dict]:
    results = (
        db.query(
            Item.name,
            func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity).label("total"),
        )
        .join(MovementLine, MovementLine.item_id == Item.id)
        .join(Movement, MovementLine.movement_id == Movement.id)
        .filter(Movement.movement_date >= start, Movement.movement_date <= end)
        .group_by(Item.name)
        .order_by(func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity).desc())
        .limit(limit)
        .all()
    )
    return [{"name": r.name, "total": float(r.total)} for r in results]


def top_items_by_quantity(db: Session, start: str, end: str, limit: int = 5) -> list[dict]:
    results = (
        db.query(
            Item.name,
            func.sum(MovementLine.quantity).label("total"),
        )
        .join(MovementLine, MovementLine.item_id == Item.id)
        .join(Movement, MovementLine.movement_id == Movement.id)
        .filter(Movement.movement_date >= start, Movement.movement_date <= end)
        .group_by(Item.name)
        .order_by(func.sum(MovementLine.quantity).desc())
        .limit(limit)
        .all()
    )
    return [{"name": r.name, "total": float(r.total)} for r in results]


def category_breakdown(db: Session, start: str, end: str) -> list[dict]:
    results = (
        db.query(
            Category.name.label("category"),
            func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity).label("total"),
        )
        .join(Item, MovementLine.item_id == Item.id)
        .join(Category, Item.category_id == Category.id)
        .join(Movement, MovementLine.movement_id == Movement.id)
        .filter(Movement.movement_date >= start, Movement.movement_date <= end)
        .group_by(Category.name)
        .order_by(func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity).desc())
        .all()
    )
    return [{"category": r.category, "total": float(r.total)} for r in results]


def monthly_totals(db: Session, months: int = 12) -> list[dict]:
    """Return monthly totals for the last N months."""
    today = date.today()
    results = []
    for i in range(months):
        # Go back i months
        month = today.month - i
        year = today.year
        while month <= 0:
            month += 12
            year -= 1
        summary = monthly_summary(db, year, month)
        results.append({
            "year": year,
            "month": month,
            "total_cost": summary["total_cost"],
            "count": summary["count"],
        })
    results.reverse()
    return results


def category_comparison(db: Session, year: int, month: int) -> list[dict]:
    """Compare category totals between current and previous month."""
    start_curr, end_curr = get_month_range(year, month)

    prev_month = month - 1
    prev_year = year
    if prev_month <= 0:
        prev_month = 12
        prev_year -= 1
    start_prev, end_prev = get_month_range(prev_year, prev_month)

    current_data = category_breakdown(db, start_curr, end_curr)
    previous_data = category_breakdown(db, start_prev, end_prev)

    prev_map = {d["category"]: d["total"] for d in previous_data}

    # Gather all category names
    all_categories = set(d["category"] for d in current_data) | set(prev_map.keys())

    curr_map = {d["category"]: d["total"] for d in current_data}

    comparison = []
    for cat in sorted(all_categories):
        current = curr_map.get(cat, 0.0)
        previous = prev_map.get(cat, 0.0)
        change_pct = 0.0
        if previous > 0:
            change_pct = round(((current - previous) / previous) * 100, 2)
        comparison.append({
            "category": cat,
            "current": current,
            "previous": previous,
            "change_pct": change_pct,
        })
    return comparison
