from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth import verify_pin, create_token, get_current_user
from app.schemas import LoginRequest, LoginResponse, LoginUser, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/users", response_model=list[LoginUser])
def list_active_users(db: Session = Depends(get_db)):
    """Public endpoint — returns id+name of active users for the login screen."""
    return db.query(User).filter(User.is_active == True).order_by(User.name).all()


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.name == req.name, User.is_active == True).first()
    if not user or not verify_pin(req.pin, user.pin_hash):
        raise HTTPException(401, "Invalid name or PIN")
    token = create_token(user.id, user.role)
    return {"token": token, "user": user}


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user
