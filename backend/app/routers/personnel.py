from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.database import get_db
from app.models import PersonnelCost, User
from app.schemas import PersonnelCostCreate, PersonnelCostOut

router = APIRouter(prefix="/api/personnel", tags=["personnel"])


@router.get("/", response_model=list[PersonnelCostOut])
def list_personnel_costs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return (
        db.query(PersonnelCost)
        .order_by(PersonnelCost.year.desc(), PersonnelCost.month.desc())
        .all()
    )


@router.post("/", response_model=PersonnelCostOut, status_code=201)
def create_or_update_personnel_cost(
    data: PersonnelCostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    total_e2n = data.bru1_e2n + data.bru2_e2n
    if total_e2n == 0:
        raise HTTPException(400, "Sum of BRU1 and BRU2 E2N values cannot be zero")

    ratio = data.bru2_e2n / total_e2n
    bru2_cost = data.total_paid * ratio

    existing = (
        db.query(PersonnelCost)
        .filter(PersonnelCost.year == data.year, PersonnelCost.month == data.month)
        .first()
    )

    if existing:
        existing.total_paid = data.total_paid
        existing.bru1_e2n = data.bru1_e2n
        existing.bru2_e2n = data.bru2_e2n
        existing.ratio = round(ratio, 6)
        existing.bru2_cost = round(bru2_cost, 2)
        existing.notes = data.notes
        db.commit()
        db.refresh(existing)
        return existing

    record = PersonnelCost(
        year=data.year,
        month=data.month,
        total_paid=data.total_paid,
        bru1_e2n=data.bru1_e2n,
        bru2_e2n=data.bru2_e2n,
        ratio=round(ratio, 6),
        bru2_cost=round(bru2_cost, 2),
        notes=data.notes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{year}/{month}", response_model=PersonnelCostOut)
def get_personnel_cost(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    record = (
        db.query(PersonnelCost)
        .filter(PersonnelCost.year == year, PersonnelCost.month == month)
        .first()
    )
    if not record:
        raise HTTPException(404, "Personnel cost record not found")
    return record


@router.delete("/{year}/{month}", response_model=PersonnelCostOut)
def delete_personnel_cost(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    record = (
        db.query(PersonnelCost)
        .filter(PersonnelCost.year == year, PersonnelCost.month == month)
        .first()
    )
    if not record:
        raise HTTPException(404, "Personnel cost record not found")
    db.delete(record)
    db.commit()
    return record
