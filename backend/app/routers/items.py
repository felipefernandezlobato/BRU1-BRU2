from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.models import Item, Category, CostHistory, User
from app.schemas import ItemCreate, ItemUpdate, ItemOut

router = APIRouter(prefix="/api/items", tags=["items"])


def _item_to_out(item: Item) -> dict:
    """Convert an Item model to a dict with category_name populated."""
    return {
        "id": item.id,
        "name": item.name,
        "category_id": item.category_id,
        "unit": item.unit,
        "cost_per_unit": item.cost_per_unit,
        "is_produced": item.is_produced,
        "escandallos_name": item.escandallos_name,
        "is_active": item.is_active,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "category_name": item.category.name if item.category else "",
    }


@router.get("/", response_model=list[ItemOut])
def list_items(
    category_id: int | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Item)
    if not include_inactive:
        query = query.filter(Item.is_active == True)
    if category_id is not None:
        query = query.filter(Item.category_id == category_id)
    items = query.order_by(Item.name).all()
    return [_item_to_out(i) for i in items]


@router.get("/{item_id}", response_model=ItemOut)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    return _item_to_out(item)


@router.post("/", response_model=ItemOut, status_code=201)
def create_item(
    data: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    category = db.query(Category).filter(Category.id == data.category_id).first()
    if not category:
        raise HTTPException(400, "Category not found")
    item = Item(
        name=data.name,
        category_id=data.category_id,
        unit=data.unit,
        cost_per_unit=data.cost_per_unit,
        is_produced=data.is_produced,
        escandallos_name=data.escandallos_name,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_to_out(item)


@router.put("/{item_id}", response_model=ItemOut)
def update_item(
    item_id: int,
    data: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")

    # Track cost change for history
    old_cost = item.cost_per_unit
    cost_changed = False

    if data.name is not None:
        item.name = data.name
    if data.category_id is not None:
        item.category_id = data.category_id
    if data.unit is not None:
        item.unit = data.unit
    if data.cost_per_unit is not None and data.cost_per_unit != old_cost:
        item.cost_per_unit = data.cost_per_unit
        cost_changed = True
    if data.is_produced is not None:
        item.is_produced = data.is_produced
    if data.escandallos_name is not None:
        item.escandallos_name = data.escandallos_name
    if data.is_active is not None:
        item.is_active = data.is_active

    if cost_changed:
        history = CostHistory(
            item_id=item.id,
            old_cost=old_cost,
            new_cost=data.cost_per_unit,
            change_source="manual",
        )
        db.add(history)

    db.commit()
    db.refresh(item)
    return _item_to_out(item)


@router.delete("/{item_id}", response_model=ItemOut)
def deactivate_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    item.is_active = False
    db.commit()
    db.refresh(item)
    return _item_to_out(item)
