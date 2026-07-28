import os
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Movement, MovementLine, Item, User
from app.schemas import MovementCreate, MovementUpdate, MovementOut
from app.services.costes import get_markup_pct, calculate_transfer_price

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "data/photos")
VALID_DIRECTIONS = {"BRU1_TO_BRU2", "BRU2_TO_BRU1"}

router = APIRouter(prefix="/api/movements", tags=["movements"])


def _build_movement_out(movement: Movement) -> dict:
    """Construct response dict with computed fields."""
    lines_out = []
    total_cost = 0.0
    for line in movement.lines:
        line_cost = line.transfer_price_snapshot * line.quantity
        total_cost += line_cost
        lines_out.append({
            "id": line.id,
            "item_id": line.item_id,
            "item_name": line.item.name if line.item else "",
            "quantity": line.quantity,
            "unit": line.unit,
            "cost_per_unit_snapshot": line.cost_per_unit_snapshot,
            "markup_pct_snapshot": line.markup_pct_snapshot,
            "transfer_price_snapshot": line.transfer_price_snapshot,
        })
    return {
        "id": movement.id,
        "direction": movement.direction,
        "created_by": movement.created_by,
        "creator_name": movement.creator.name if movement.creator else "",
        "notes": movement.notes,
        "photo_filename": movement.photo_filename,
        "movement_date": movement.movement_date,
        "created_at": movement.created_at,
        "lines": lines_out,
        "total_cost": round(total_cost, 4),
    }


def _check_staff_permission(movement: Movement, user: User):
    """Staff can only modify own movements within 24 hours."""
    if user.role == "admin":
        return
    if movement.created_by != user.id:
        raise HTTPException(403, "You can only modify your own movements")
    if datetime.utcnow() - movement.created_at > timedelta(hours=24):
        raise HTTPException(403, "Cannot modify movements older than 24 hours")


def _create_lines(db: Session, movement_id: int, lines_data, markup_pct: float) -> list[MovementLine]:
    """Create movement lines with cost snapshots."""
    new_lines = []
    for line_data in lines_data:
        item = db.query(Item).filter(Item.id == line_data.item_id, Item.is_active == True).first()
        if not item:
            raise HTTPException(400, f"Item {line_data.item_id} not found or inactive")
        cost, markup, transfer_price = calculate_transfer_price(item, markup_pct)
        ml = MovementLine(
            movement_id=movement_id,
            item_id=line_data.item_id,
            quantity=line_data.quantity,
            unit=line_data.unit,
            cost_per_unit_snapshot=cost,
            markup_pct_snapshot=markup,
            transfer_price_snapshot=transfer_price,
        )
        db.add(ml)
        new_lines.append(ml)
    return new_lines


@router.get("/", response_model=list[MovementOut])
def list_movements(
    start_date: str | None = None,
    end_date: str | None = None,
    direction: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Movement)
    if start_date:
        query = query.filter(Movement.movement_date >= start_date)
    if end_date:
        query = query.filter(Movement.movement_date <= end_date)
    if direction:
        query = query.filter(Movement.direction == direction)
    movements = (
        query.order_by(Movement.movement_date.desc(), Movement.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_build_movement_out(m) for m in movements]


@router.get("/{movement_id}", response_model=MovementOut)
def get_movement(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movement = db.query(Movement).filter(Movement.id == movement_id).first()
    if not movement:
        raise HTTPException(404, "Movement not found")
    return _build_movement_out(movement)


@router.post("/", response_model=MovementOut, status_code=201)
def create_movement(
    data: MovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.direction not in VALID_DIRECTIONS:
        raise HTTPException(400, f"Invalid direction. Must be one of: {', '.join(VALID_DIRECTIONS)}")
    if not data.lines:
        raise HTTPException(400, "Movement must have at least one line")

    markup_pct = get_markup_pct(db)

    movement = Movement(
        direction=data.direction,
        created_by=current_user.id,
        notes=data.notes,
        movement_date=data.movement_date,
    )
    db.add(movement)
    db.flush()

    _create_lines(db, movement.id, data.lines, markup_pct)

    db.commit()
    db.refresh(movement)
    return _build_movement_out(movement)


@router.put("/{movement_id}", response_model=MovementOut)
def update_movement(
    movement_id: int,
    data: MovementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movement = db.query(Movement).filter(Movement.id == movement_id).first()
    if not movement:
        raise HTTPException(404, "Movement not found")

    _check_staff_permission(movement, current_user)

    if data.direction is not None:
        if data.direction not in VALID_DIRECTIONS:
            raise HTTPException(400, f"Invalid direction. Must be one of: {', '.join(VALID_DIRECTIONS)}")
        movement.direction = data.direction
    if data.movement_date is not None:
        movement.movement_date = data.movement_date
    if data.notes is not None:
        movement.notes = data.notes

    if data.lines is not None:
        # Delete old lines and recreate with fresh cost snapshots
        for line in movement.lines:
            db.delete(line)
        db.flush()
        markup_pct = get_markup_pct(db)
        _create_lines(db, movement.id, data.lines, markup_pct)

    db.commit()
    db.refresh(movement)
    return _build_movement_out(movement)


@router.delete("/{movement_id}")
def delete_movement(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movement = db.query(Movement).filter(Movement.id == movement_id).first()
    if not movement:
        raise HTTPException(404, "Movement not found")

    _check_staff_permission(movement, current_user)

    db.delete(movement)
    db.commit()
    return {"detail": "Movement deleted"}


# --- Photo endpoints ---

@router.post("/{movement_id}/photo")
def upload_photo(
    movement_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movement = db.query(Movement).filter(Movement.id == movement_id).first()
    if not movement:
        raise HTTPException(404, "Movement not found")

    contents = file.file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(400, "File too large. Maximum size is 5MB")

    from PIL import Image
    import io

    try:
        img = Image.open(io.BytesIO(contents))
    except Exception:
        raise HTTPException(400, "Invalid image file")

    img.thumbnail((1200, 1200))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Delete old photo if replacing
    if movement.photo_filename:
        old_path = os.path.join(UPLOAD_DIR, movement.photo_filename)
        if os.path.exists(old_path):
            os.remove(old_path)

    filename = f"{movement.id}_{uuid.uuid4().hex[:8]}.jpg"
    filepath = os.path.join(UPLOAD_DIR, filename)
    img.save(filepath, "JPEG", quality=80)

    movement.photo_filename = filename
    db.commit()

    return {"filename": filename}


@router.get("/{movement_id}/photo")
def get_photo(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movement = db.query(Movement).filter(Movement.id == movement_id).first()
    if not movement:
        raise HTTPException(404, "Movement not found")
    if not movement.photo_filename:
        raise HTTPException(404, "No photo for this movement")

    filepath = os.path.join(UPLOAD_DIR, movement.photo_filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "Photo file not found")

    return FileResponse(filepath, media_type="image/jpeg")
