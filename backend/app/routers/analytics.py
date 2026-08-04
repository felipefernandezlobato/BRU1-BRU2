from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.models import User, Movement, MovementLine, Item, PersonnelCost, Setting
from app.schemas import AnalyticsSummary
from app.services.analytics import (
    get_month_range,
    monthly_summary,
    top_items_by_cost,
    top_items_by_quantity,
    category_comparison,
    monthly_totals,
    category_breakdown,
    monthly_markup,
    markup_summary,
)
from sqlalchemy import func

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    today = date.today()
    curr_year, curr_month = today.year, today.month

    prev_month = curr_month - 1
    prev_year = curr_year
    if prev_month <= 0:
        prev_month = 12
        prev_year -= 1

    curr = monthly_summary(db, curr_year, curr_month)
    prev = monthly_summary(db, prev_year, prev_month)

    cost_change = 0.0
    if prev["total_cost"] > 0:
        cost_change = round(((curr["total_cost"] - prev["total_cost"]) / prev["total_cost"]) * 100, 2)

    movements_change = 0.0
    if prev["count"] > 0:
        movements_change = round(((curr["count"] - prev["count"]) / prev["count"]) * 100, 2)

    start_curr, end_curr = get_month_range(curr_year, curr_month)
    top_cost = top_items_by_cost(db, start_curr, end_curr)
    top_qty = top_items_by_quantity(db, start_curr, end_curr)
    cat_comp = category_comparison(db, curr_year, curr_month)

    curr_markup = markup_summary(db, curr_year, curr_month)
    prev_markup = markup_summary(db, prev_year, prev_month)
    markup_change = 0.0
    if prev_markup > 0:
        markup_change = round(((curr_markup - prev_markup) / prev_markup) * 100, 2)

    return AnalyticsSummary(
        current_month_cost=curr["total_cost"],
        previous_month_cost=prev["total_cost"],
        cost_change_pct=cost_change,
        current_month_movements=curr["count"],
        previous_month_movements=prev["count"],
        movements_change_pct=movements_change,
        top_items_by_cost=top_cost,
        top_items_by_quantity=top_qty,
        category_comparison=cat_comp,
        current_month_markup=curr_markup,
        previous_month_markup=prev_markup,
        markup_change_pct=markup_change,
    )


@router.get("/monthly")
def get_monthly_totals(
    months: int = 12,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return monthly_totals(db, months)


@router.get("/markup")
def get_markup_totals(
    months: int = 12,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return monthly_markup(db, months)


@router.get("/categories")
def get_category_breakdown(
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return category_breakdown(db, start_date, end_date)


@router.get("/items")
def get_item_trends(
    start_date: str,
    end_date: str,
    item_ids: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = (
        db.query(
            Item.id,
            Item.name,
            func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity).label("total_cost"),
            func.sum(MovementLine.quantity).label("total_quantity"),
        )
        .join(MovementLine, MovementLine.item_id == Item.id)
        .join(Movement, MovementLine.movement_id == Movement.id)
        .filter(Movement.movement_date >= start_date, Movement.movement_date <= end_date)
    )
    if item_ids:
        ids = [int(x.strip()) for x in item_ids.split(",") if x.strip()]
        query = query.filter(Item.id.in_(ids))

    results = query.group_by(Item.id, Item.name).order_by(
        func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity).desc()
    ).all()

    return [
        {
            "id": r.id,
            "name": r.name,
            "total_cost": float(r.total_cost),
            "total_quantity": float(r.total_quantity),
        }
        for r in results
    ]


@router.get("/direction")
def get_direction_split(
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    results = (
        db.query(
            Movement.direction,
            func.coalesce(
                func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity), 0
            ).label("total_cost"),
            func.count(func.distinct(Movement.id)).label("count"),
        )
        .join(MovementLine, MovementLine.movement_id == Movement.id)
        .filter(Movement.movement_date >= start_date, Movement.movement_date <= end_date)
        .group_by(Movement.direction)
        .all()
    )
    return [
        {
            "direction": r.direction,
            "total_cost": float(r.total_cost),
            "count": r.count,
        }
        for r in results
    ]


@router.get("/monthly-combined")
def get_monthly_combined(
    months: int = 12,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    movement_data = monthly_totals(db, months)
    rent_row = db.query(Setting).filter(Setting.key == "monthly_rent").first()
    monthly_rent = float(rent_row.value) if rent_row else 0.0

    # BRU2 opened 2026-02-16: no rent before Feb, half rent in Feb, full from March
    OPEN_YEAR, OPEN_MONTH = 2026, 2

    result = []
    for m in movement_data:
        pc = db.query(PersonnelCost).filter(
            PersonnelCost.year == m["year"],
            PersonnelCost.month == m["month"],
        ).first()

        y, mo = m["year"], m["month"]
        if y < OPEN_YEAR or (y == OPEN_YEAR and mo < OPEN_MONTH):
            rent = 0.0
        elif y == OPEN_YEAR and mo == OPEN_MONTH:
            rent = round(monthly_rent / 2, 2)
        else:
            rent = monthly_rent

        result.append({
            "year": y,
            "month": mo,
            "movement_cost": m["total_cost"],
            "personnel_cost": round(pc.bru2_cost, 2) if pc else 0.0,
            "rent": rent,
        })
    return result
