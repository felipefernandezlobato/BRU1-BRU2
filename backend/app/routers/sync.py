import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.models import Item, Setting, CostHistory, User
from pydantic import BaseModel

router = APIRouter(prefix="/api/sync", tags=["sync"])


class SyncMatch(BaseModel):
    item_id: int
    item_name: str
    escandallos_name: str
    current_cost: float
    new_cost: float


class SyncConfirmItem(BaseModel):
    item_id: int
    new_cost: float


def _escandallos_url(db: Session) -> str:
    url_setting = db.query(Setting).filter(Setting.key == "escandallos_api_url").first()
    if not url_setting:
        raise HTTPException(400, "escandallos_api_url setting not configured")
    return url_setting.value.rstrip("/")


def _fetch_ingredients(db: Session) -> list[dict]:
    """Fetch the ingredient list from the configured Escandallos API."""
    try:
        resp = httpx.get(f"{_escandallos_url(db)}/api/ingredients", timeout=30)
        resp.raise_for_status()
        return resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch escandallos data: {str(e)}")


@router.post("/test")
def test_escandallos_connection(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Check the configured Escandallos URL is reachable.

    Deliberately hits /api/health, the only endpoint Escandallos serves without
    a token. Its ingredient endpoints all return 401 and this app holds no
    Escandallos credential, so a connectivity check is as far as we can verify
    without one.
    """
    base = _escandallos_url(db)
    try:
        resp = httpx.get(f"{base}/api/health", timeout=30)
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(502, f"Failed to reach escandallos: {str(e)}")
    return {"ok": True, "url": base}


@router.post("/escandallos")
def sync_escandallos(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    ingredients = _fetch_ingredients(db)

    # Build lookup by escandallos_name
    items = db.query(Item).filter(Item.escandallos_name.isnot(None), Item.is_active == True).all()
    item_map = {item.escandallos_name: item for item in items}

    matches = []
    for ingredient in ingredients:
        name = ingredient.get("name", "")
        cost = ingredient.get("cost", 0.0)
        if name in item_map:
            item = item_map[name]
            matches.append({
                "item_id": item.id,
                "item_name": item.name,
                "escandallos_name": name,
                "current_cost": item.cost_per_unit,
                "new_cost": cost,
            })
    return matches


@router.post("/confirm")
def confirm_sync(
    updates: list[SyncConfirmItem],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    applied = []
    for update in updates:
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
    return {"applied": applied, "count": len(applied)}
