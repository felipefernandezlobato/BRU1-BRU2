from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# --- Auth ---

class LoginRequest(BaseModel):
    name: str
    pin: str


class LoginUser(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


# --- User ---

class UserBase(BaseModel):
    name: str
    role: str = "staff"


class UserCreate(UserBase):
    pin: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    pin: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Category ---

class CategoryBase(BaseModel):
    name: str
    position: int = 0


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryOut(CategoryBase):
    id: int
    is_active: bool

    model_config = {"from_attributes": True}


# --- Item ---

class ItemBase(BaseModel):
    name: str
    category_id: int
    unit: str
    cost_per_unit: float = 0.0
    is_produced: bool = False
    escandallos_name: Optional[str] = None


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    unit: Optional[str] = None
    cost_per_unit: Optional[float] = None
    is_produced: Optional[bool] = None
    escandallos_name: Optional[str] = None
    is_active: Optional[bool] = None


class ItemOut(ItemBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    category_name: str = ""

    model_config = {"from_attributes": True}


# --- Movement ---

class MovementLineCreate(BaseModel):
    item_id: int
    quantity: float
    unit: str


class MovementCreate(BaseModel):
    direction: str
    movement_date: str
    notes: Optional[str] = None
    lines: list[MovementLineCreate]


class MovementUpdate(BaseModel):
    direction: Optional[str] = None
    movement_date: Optional[str] = None
    notes: Optional[str] = None
    lines: Optional[list[MovementLineCreate]] = None
    line_ids: Optional[list[int]] = None
    line_quantities: Optional[dict[str, float]] = None


class MovementLineOut(BaseModel):
    id: int
    item_id: int
    item_name: str = ""
    quantity: float
    unit: str
    cost_per_unit_snapshot: float
    markup_pct_snapshot: float
    transfer_price_snapshot: float

    model_config = {"from_attributes": True}


class MovementOut(BaseModel):
    id: int
    direction: str
    created_by: int
    creator_name: str = ""
    notes: Optional[str] = None
    photo_filename: Optional[str] = None
    movement_date: str
    created_at: datetime
    lines: list[MovementLineOut] = []
    total_cost: float = 0.0

    model_config = {"from_attributes": True}


# --- Setting ---

class SettingOut(BaseModel):
    key: str
    value: str

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    value: str


# --- Analytics ---

class AnalyticsSummary(BaseModel):
    current_month_cost: float = 0.0
    previous_month_cost: float = 0.0
    cost_change_pct: float = 0.0
    current_month_movements: int = 0
    previous_month_movements: int = 0
    movements_change_pct: float = 0.0
    top_items_by_cost: list[dict] = []
    top_items_by_quantity: list[dict] = []
    category_comparison: list[dict] = []


# --- Login Response ---

class LoginResponse(BaseModel):
    token: str
    user: UserOut


# --- Personnel Cost ---

class PersonnelCostCreate(BaseModel):
    year: int
    month: int
    total_paid: float
    bru1_e2n: float
    bru2_e2n: float
    notes: Optional[str] = None


class PersonnelCostOut(BaseModel):
    id: int
    year: int
    month: int
    total_paid: float
    bru1_e2n: float
    bru2_e2n: float
    ratio: float
    bru2_cost: float
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
