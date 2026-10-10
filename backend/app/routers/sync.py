from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.models import Item, CostHistory, User
from app.services.escandallos import (
    EscandallosNotConfigured,
    ingredient_costs,
    ingredient_count,
)
from pydantic import BaseModel

router = APIRouter(prefix="/api/sync", tags=["sync"])


class SyncConfirmItem(BaseModel):
    item_id: int
    new_cost: float


def _read_escandallos(fn, *args):
    """Run an Escandallos read, mapping its failures onto HTTP errors."""
    try:
        return fn(*args)
    except EscandallosNotConfigured:
        raise HTTPException(400, "ESCANDALLOS_DATABASE_URL no configurado")
    except Exception as e:
        raise HTTPException(502, f"Failed to read escandallos data: {str(e)}")


@router.post("/test")
def test_escandallos_connection(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Check the Escandallos database is reachable before running a sync."""
    count = _read_escandallos(ingredient_count)
    return {"ok": True, "ingredients": count}


@router.post("/escandallos")
def sync_escandallos(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Preview cost changes for items linked to Escandallos by escandallos_name.

    Nothing is written here — the admin reviews the preview and applies it via
    /confirm.
    """
    costs = _read_escandallos(ingredient_costs)
    cost_by_name = {c["nombre"]: c["cost"] for c in costs}

    items = (
        db.query(Item)
        .filter(Item.escandallos_name.isnot(None), Item.is_active == True)  # noqa: E712
        .order_by(Item.name)
        .all()
    )

    matches: list[dict] = []
    skipped: list[dict] = []
    for item in items:
        new_cost = cost_by_name.get(item.escandallos_name)
        if new_cost is None:
            skipped.append({
                "name": item.name,
                "escandallos_name": item.escandallos_name,
                "reason": "no encontrado en Escandallos",
            })
            continue
        # A cost of zero means Escandallos could not price it (a frozen item
        # whose origin bean is missing, a bad merma). Overwriting a real cost
        # with zero would silently corrupt every future movement, so refuse.
        if new_cost <= 0:
            skipped.append({
                "name": item.name,
                "escandallos_name": item.escandallos_name,
                "reason": "coste cero en Escandallos",
            })
            continue
        new_cost = round(new_cost, 4)
        if new_cost == round(item.cost_per_unit, 4):
            continue
        matches.append({
            "item_id": item.id,
            "name": item.name,
            "escandallos_name": item.escandallos_name,
            "current_cost": item.cost_per_unit,
            "new_cost": new_cost,
        })

    return {"matches": matches, "skipped": skipped}


@router.post("/confirm")
def confirm_sync(
    updates: list[SyncConfirmItem],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    applied = []
    for update in updates:
        if update.new_cost <= 0:
            continue
        item = db.query(Item).filter(Item.id == update.item_id).first()
        if not item:
            continue
        old_cost = item.cost_per_unit
        item.cost_per_unit = update.new_cost

        history = CostHistory(
            item_id=item.id,
            old_cost=old_cost,
            new_cost=update.new_cost,
            change_source="sync",
        )
        db.add(history)
        applied.append({
            "item_id": item.id,
            "item_name": item.name,
            "old_cost": old_cost,
            "new_cost": update.new_cost,
        })

    db.commit()
    return {"applied": applied, "updated": len(applied)}
