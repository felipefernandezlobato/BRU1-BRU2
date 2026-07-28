from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin, hash_pin
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserUpdate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=list[UserOut])
def list_users(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(User)
    if not include_inactive:
        query = query.filter(User.is_active == True)
    return query.order_by(User.name).all()


@router.post("/", response_model=UserOut, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = (
        db.query(User)
        .filter(User.name == data.name, User.is_active == True)
        .first()
    )
    if existing:
        raise HTTPException(400, "A user with that name already exists")
    user = User(
        name=data.name,
        pin_hash=hash_pin(data.pin),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if data.role and data.role != "admin" and user.id == current_user.id:
        raise HTTPException(400, "Cannot demote yourself")
    if data.name is not None:
        user.name = data.name
    if data.pin is not None:
        user.pin_hash = hash_pin(data.pin)
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", response_model=UserOut)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    # Check if this is the last active admin
    if user.role == "admin":
        admin_count = (
            db.query(User)
            .filter(User.role == "admin", User.is_active == True)
            .count()
        )
        if admin_count <= 1:
            raise HTTPException(400, "Cannot deactivate the last admin")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user
