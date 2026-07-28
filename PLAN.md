# BRU Stock Movements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an inter-location stock movement tracker for BRU Specialty Coffee (BRU1 ↔ BRU2) with cost analytics.

**Architecture:** Next.js 16 frontend (App Router, all `"use client"`) backed by a FastAPI REST API with SQLAlchemy 2.0 ORM. PostgreSQL (Neon) in production, SQLite for local dev. Same architecture as Escandallos and Checklists apps.

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 | FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2 | Neon PostgreSQL / SQLite | Chart.js | pytest + httpx

## Global Constraints

- All UI text in **Spanish** — every label, message, placeholder, button
- Currency is **CHF** (Swiss Francs)
- Mobile-first, PWA-enabled (manifest.json, standalone, iOS safe areas)
- Zero external UI libraries — all components hand-built with Tailwind
- Inline SVG icons — no icon library
- Fonts: EB Garamond (display) + DM Sans (body) via `next/font/google`
- Brand color: `#861A22` (maroon)
- Backend port 8002 (Escandallos=8000, Checklists=8001)
- Frontend dev on port 3002
- localStorage key: `bru_movements_token`
- Free tier hosting only (Vercel + Render + Neon)
- Cost snapshots on movements — historical data always reflects prices at time of logging

---

### Task 1: Backend Scaffold + Database Models

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/database.py`
- Create: `backend/app/models.py`
- Create: `backend/app/main.py`
- Create: `backend/requirements.txt`
- Create: `backend/start.sh`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/` (directory)
- Create: `backend/data/` (directory)
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_models.py`
- Create: `backend/.python-version`
- Create: `render.yaml`

**Interfaces:**
- Consumes: Nothing (first task)
- Produces: `Base` (DeclarativeBase), `get_db()` dependency, `engine`, `SessionLocal`, models: `User`, `Category`, `Item`, `Movement`, `MovementLine`, `Setting`, `CostHistory`

- [ ] **Step 1: Create backend directory structure**

```bash
mkdir -p backend/app/routers backend/app/services backend/tests backend/data backend/alembic/versions
touch backend/app/__init__.py backend/app/routers/__init__.py backend/app/services/__init__.py backend/tests/__init__.py
```

- [ ] **Step 2: Create requirements.txt**

```
fastapi==0.115.12
uvicorn==0.34.3
sqlalchemy==2.0.41
alembic==1.16.2
pydantic==2.11.3
python-multipart==0.0.20
python-dotenv==1.1.1
psycopg2-binary==2.9.10
bcrypt==4.3.0
pyjwt==2.10.1
pillow==11.2.1
pytest==8.3.5
httpx==0.28.1
pytest-asyncio==0.25.3
```

Note: `pillow` is for photo compression (Task 6). `python-multipart` is for file uploads.

- [ ] **Step 3: Create .python-version**

```
3.12
```

- [ ] **Step 4: Create database.py**

```python
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///data/movements.db")

is_sqlite = "sqlite" in DATABASE_URL

engine_kwargs = {}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(DATABASE_URL, **engine_kwargs)

if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 5: Create models.py**

```python
import sqlalchemy as sa
from sqlalchemy import ForeignKey, text as sa_text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(sa.String(100))
    pin_hash: Mapped[str] = mapped_column(sa.String(200))
    role: Mapped[str] = mapped_column(sa.String(20), default="staff")
    is_active: Mapped[bool] = mapped_column(default=True, server_default=sa_text("true"))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    movements: Mapped[list["Movement"]] = relationship(back_populates="creator")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(sa.String(100))
    position: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(default=True, server_default=sa_text("true"))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    items: Mapped[list["Item"]] = relationship(back_populates="category")


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(sa.String(200))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    unit: Mapped[str] = mapped_column(sa.String(20))  # kg, g, mg, litro, ml, cl, unidad
    cost_per_unit: Mapped[float] = mapped_column(sa.Float, default=0.0)
    is_produced: Mapped[bool] = mapped_column(default=False, server_default=sa_text("false"))
    escandallos_name: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, server_default=sa_text("true"))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    category: Mapped["Category"] = relationship(back_populates="items")
    movement_lines: Mapped[list["MovementLine"]] = relationship(back_populates="item")
    cost_history: Mapped[list["CostHistory"]] = relationship(back_populates="item")


class Movement(Base):
    __tablename__ = "movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    direction: Mapped[str] = mapped_column(sa.String(20))  # BRU1_TO_BRU2 or BRU2_TO_BRU1
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    photo_filename: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    movement_date: Mapped[str] = mapped_column(sa.String(10))  # "2026-07-28"
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    creator: Mapped["User"] = relationship(back_populates="movements")
    lines: Mapped[list["MovementLine"]] = relationship(
        back_populates="movement", cascade="all, delete-orphan"
    )


class MovementLine(Base):
    __tablename__ = "movement_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    movement_id: Mapped[int] = mapped_column(ForeignKey("movements.id", ondelete="CASCADE"))
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"))
    quantity: Mapped[float] = mapped_column(sa.Float)
    unit: Mapped[str] = mapped_column(sa.String(20))
    cost_per_unit_snapshot: Mapped[float] = mapped_column(sa.Float)
    markup_pct_snapshot: Mapped[float] = mapped_column(sa.Float, default=0.0)
    transfer_price_snapshot: Mapped[float] = mapped_column(sa.Float)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    movement: Mapped["Movement"] = relationship(back_populates="lines")
    item: Mapped["Item"] = relationship(back_populates="movement_lines")


class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(sa.String(100), unique=True)
    value: Mapped[str] = mapped_column(sa.String(500))


class CostHistory(Base):
    __tablename__ = "cost_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"))
    old_cost: Mapped[float] = mapped_column(sa.Float)
    new_cost: Mapped[float] = mapped_column(sa.Float)
    changed_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    change_source: Mapped[str] = mapped_column(sa.String(20))  # manual or sync

    item: Mapped["Item"] = relationship(back_populates="cost_history")
```

- [ ] **Step 6: Create minimal main.py with health check**

```python
import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db

load_dotenv()

app = FastAPI(title="BRU Stock Movements API")

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
origins = [o.strip() for o in CORS_ORIGINS.split(",")] if CORS_ORIGINS != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    return {"status": "ok"}
```

- [ ] **Step 7: Create start.sh**

```bash
#!/bin/bash
echo "Running alembic upgrade head..."
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

```bash
chmod +x backend/start.sh
```

- [ ] **Step 8: Initialize Alembic**

```bash
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic init alembic
```

Then replace `alembic/env.py` with:

```python
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

db_url = os.environ.get("DATABASE_URL")
if db_url:
    config.set_main_option("sqlalchemy.url", db_url)

from app.database import Base
from app import models  # noqa: F401

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Set `sqlalchemy.url` in `alembic.ini`:
```
sqlalchemy.url = sqlite:///./data/movements.db
```

- [ ] **Step 9: Generate initial migration**

```bash
cd backend && source venv/bin/activate
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

- [ ] **Step 10: Create test conftest.py**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.auth import hash_pin, create_token
from app.models import User, Category, Item

SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db):
    user = User(name="Admin", pin_hash=hash_pin("1234"), role="admin")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def staff_user(db):
    user = User(name="Staff", pin_hash=hash_pin("5678"), role="staff")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user):
    return create_token(admin_user.id, admin_user.role)


@pytest.fixture
def staff_token(staff_user):
    return create_token(staff_user.id, staff_user.role)


@pytest.fixture
def admin_client(client, admin_token):
    client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return client


@pytest.fixture
def staff_client(client, staff_token):
    client.headers.update({"Authorization": f"Bearer {staff_token}"})
    return client


@pytest.fixture
def category_cafe(db):
    cat = Category(name="Cafe", position=0)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@pytest.fixture
def category_panaderia(db):
    cat = Category(name="Panadería", position=1)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@pytest.fixture
def item_coffee(db, category_cafe):
    item = Item(
        name="Ethiopia Yirgacheffe 1kg",
        category_id=category_cafe.id,
        unit="unidad",
        cost_per_unit=18.50,
        is_produced=False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def item_croissant(db, category_panaderia):
    item = Item(
        name="Croissant mantequilla",
        category_id=category_panaderia.id,
        unit="unidad",
        cost_per_unit=0.85,
        is_produced=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
```

Note: `hash_pin` and `create_token` will be created in Task 2. For now, this file references them — the tests won't run until Task 2 is complete.

- [ ] **Step 11: Write model tests**

```python
# backend/tests/test_models.py
import pytest
from datetime import datetime
from sqlalchemy.exc import IntegrityError

from app.models import User, Category, Item, Movement, MovementLine, Setting, CostHistory


def test_create_user(db):
    from app.auth import hash_pin
    user = User(name="Alice", pin_hash=hash_pin("9999"), role="admin")
    db.add(user)
    db.commit()
    db.refresh(user)
    assert user.id is not None
    assert user.name == "Alice"
    assert user.role == "admin"
    assert user.is_active is True
    assert isinstance(user.created_at, datetime)


def test_create_category(db):
    cat = Category(name="Cafe", position=0)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    assert cat.id is not None
    assert cat.name == "Cafe"
    assert cat.is_active is True


def test_create_item(db):
    cat = Category(name="Cafe")
    db.add(cat)
    db.commit()
    item = Item(
        name="Ethiopia 1kg", category_id=cat.id, unit="unidad",
        cost_per_unit=18.50, is_produced=False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    assert item.id is not None
    assert item.category.name == "Cafe"
    assert item.is_produced is False
    assert item.escandallos_name is None


def test_create_movement_with_lines(db):
    from app.auth import hash_pin
    user = User(name="Sender", pin_hash=hash_pin("0000"), role="staff")
    cat = Category(name="Cafe")
    db.add_all([user, cat])
    db.commit()
    item = Item(name="Coffee", category_id=cat.id, unit="unidad", cost_per_unit=10.0)
    db.add(item)
    db.commit()

    movement = Movement(
        direction="BRU1_TO_BRU2", created_by=user.id,
        movement_date="2026-07-28",
    )
    db.add(movement)
    db.commit()

    line = MovementLine(
        movement_id=movement.id, item_id=item.id,
        quantity=5, unit="unidad",
        cost_per_unit_snapshot=10.0, markup_pct_snapshot=0.0,
        transfer_price_snapshot=10.0,
    )
    db.add(line)
    db.commit()
    db.refresh(movement)

    assert len(movement.lines) == 1
    assert movement.lines[0].quantity == 5
    assert movement.creator.name == "Sender"


def test_movement_cascade_delete(db):
    from app.auth import hash_pin
    user = User(name="U", pin_hash=hash_pin("0000"), role="staff")
    cat = Category(name="C")
    db.add_all([user, cat])
    db.commit()
    item = Item(name="I", category_id=cat.id, unit="unidad", cost_per_unit=1.0)
    db.add(item)
    db.commit()

    movement = Movement(direction="BRU1_TO_BRU2", created_by=user.id, movement_date="2026-07-28")
    db.add(movement)
    db.commit()
    line = MovementLine(
        movement_id=movement.id, item_id=item.id,
        quantity=1, unit="unidad",
        cost_per_unit_snapshot=1.0, markup_pct_snapshot=0.0, transfer_price_snapshot=1.0,
    )
    db.add(line)
    db.commit()

    db.delete(movement)
    db.commit()
    assert db.query(MovementLine).count() == 0


def test_setting_unique_key(db):
    s1 = Setting(key="markup_pct", value="30")
    db.add(s1)
    db.commit()
    s2 = Setting(key="markup_pct", value="40")
    db.add(s2)
    with pytest.raises(IntegrityError):
        db.commit()


def test_cost_history(db):
    cat = Category(name="C")
    db.add(cat)
    db.commit()
    item = Item(name="I", category_id=cat.id, unit="unidad", cost_per_unit=10.0)
    db.add(item)
    db.commit()
    history = CostHistory(
        item_id=item.id, old_cost=10.0, new_cost=12.0, change_source="manual",
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    assert history.item.name == "I"
    assert history.change_source == "manual"


def test_item_category_relationship(db):
    cat = Category(name="Panadería")
    db.add(cat)
    db.commit()
    i1 = Item(name="Croissant", category_id=cat.id, unit="unidad", cost_per_unit=0.5)
    i2 = Item(name="Pain au chocolat", category_id=cat.id, unit="unidad", cost_per_unit=0.6)
    db.add_all([i1, i2])
    db.commit()
    db.refresh(cat)
    assert len(cat.items) == 2
```

- [ ] **Step 12: Create render.yaml**

```yaml
services:
  - type: web
    name: bru-movements-api
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: bash start.sh
    envVars:
      - key: SECRET_KEY
        generateValue: true
      - key: CORS_ORIGINS
        sync: false
      - key: DATABASE_URL
        sync: false
    disk:
      name: data
      mountPath: /opt/render/project/src/backend/data
      sizeGB: 1
```

- [ ] **Step 13: Run model tests to verify**

```bash
cd backend && source venv/bin/activate
pytest tests/test_models.py -v
```

Expected: All tests PASS (after Task 2 creates auth.py — if running standalone, temporarily create a minimal `hash_pin` function or skip auth-dependent tests).

- [ ] **Step 14: Commit**

```bash
git add backend/ render.yaml
git commit -m "feat: backend scaffold with database models and alembic migrations"
```

---

### Task 2: Auth System + Seed Data

**Files:**
- Create: `backend/app/auth.py`
- Create: `backend/app/seed.py`
- Create: `backend/app/schemas.py`
- Create: `backend/app/routers/auth.py`
- Modify: `backend/app/main.py` (register router, add startup seed)
- Create: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `User` model, `get_db()`, `Base`, `SessionLocal`
- Produces: `hash_pin(pin) -> str`, `verify_pin(pin, hash) -> bool`, `create_token(user_id, role) -> str`, `get_current_user` (FastAPI dependency), `require_admin` (FastAPI dependency), `seed_data(db)`, Pydantic schemas

- [ ] **Step 1: Create auth.py**

```python
import os
from datetime import datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-prod")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

security = HTTPBearer()


def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()


def verify_pin(pin: str, pin_hash: str) -> bool:
    return bcrypt.checkpw(pin.encode(), pin_hash.encode())


def create_token(user_id: int, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user or not user.is_active:
        raise HTTPException(401, "User not found or inactive")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return user
```

- [ ] **Step 2: Create schemas.py**

```python
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# --- Auth ---

class LoginRequest(BaseModel):
    name: str
    pin: str


class LoginResponse(BaseModel):
    token: str
    user: UserOut


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
    category_name: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Movement ---

class MovementLineCreate(BaseModel):
    item_id: int
    quantity: float
    unit: str


class MovementCreate(BaseModel):
    direction: str  # BRU1_TO_BRU2 or BRU2_TO_BRU1
    movement_date: str  # "2026-07-28"
    notes: Optional[str] = None
    lines: list[MovementLineCreate]


class MovementLineOut(BaseModel):
    id: int
    item_id: int
    item_name: Optional[str] = None
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
    creator_name: Optional[str] = None
    notes: Optional[str] = None
    photo_filename: Optional[str] = None
    movement_date: str
    created_at: datetime
    lines: list[MovementLineOut] = []
    total_cost: float = 0.0

    model_config = {"from_attributes": True}


class MovementUpdate(BaseModel):
    direction: Optional[str] = None
    movement_date: Optional[str] = None
    notes: Optional[str] = None
    lines: Optional[list[MovementLineCreate]] = None


# --- Settings ---

class SettingOut(BaseModel):
    key: str
    value: str

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    value: str


# --- Analytics ---

class AnalyticsSummary(BaseModel):
    current_month_cost: float
    previous_month_cost: float
    cost_change_pct: float
    current_month_count: int
    previous_month_count: int
    top_items_by_cost: list[dict]
    top_items_by_quantity: list[dict]
    category_comparison: list[dict]
```

Note: `LoginResponse` references `UserOut` before it's defined — use `from __future__ import annotations` at top for forward references.

- [ ] **Step 3: Create auth router**

```python
# backend/app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth import verify_pin, create_token, get_current_user
from app.schemas import LoginRequest, LoginUser, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.name == data.name, User.is_active == True).first()
    if not user or not verify_pin(data.pin, user.pin_hash):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user.id, user.role)
    return {
        "token": token,
        "user": {"id": user.id, "name": user.name, "role": user.role, "is_active": user.is_active},
    }


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.get("/users", response_model=list[LoginUser])
def list_login_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.is_active == True).order_by(User.name).all()
    return users
```

- [ ] **Step 4: Create seed.py**

```python
from app.auth import hash_pin
from app.models import User, Setting


def seed_data(db):
    existing = db.query(User).first()
    if existing:
        return

    admin = User(name="Admin", pin_hash=hash_pin("0000"), role="admin")
    db.add(admin)

    # Default settings
    db.add(Setting(key="markup_pct", value="30"))
    db.add(Setting(key="escandallos_api_url", value="https://bru-escandallos-api.onrender.com"))

    db.commit()
```

- [ ] **Step 5: Update main.py — register router and startup seed**

```python
import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.routers import auth as auth_router
from app.seed import seed_data

load_dotenv()

app = FastAPI(title="BRU Stock Movements API")

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
origins = [o.strip() for o in CORS_ORIGINS.split(",")] if CORS_ORIGINS != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    return {"status": "ok"}
```

- [ ] **Step 6: Write auth tests**

```python
# backend/tests/test_auth.py
from datetime import datetime, timedelta
import jwt
from app.auth import SECRET_KEY, ALGORITHM, hash_pin, verify_pin, create_token
from app.models import User


def test_pin_hash_verification():
    hashed = hash_pin("1234")
    assert verify_pin("1234", hashed) is True


def test_pin_hash_wrong_pin():
    hashed = hash_pin("1234")
    assert verify_pin("9999", hashed) is False


def test_login_success(client, admin_user):
    resp = client.post("/api/auth/login", json={"name": "Admin", "pin": "1234"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["user"]["name"] == "Admin"
    assert data["user"]["role"] == "admin"


def test_login_wrong_pin(client, admin_user):
    resp = client.post("/api/auth/login", json={"name": "Admin", "pin": "0000"})
    assert resp.status_code == 401


def test_login_wrong_name(client):
    resp = client.post("/api/auth/login", json={"name": "Ghost", "pin": "1234"})
    assert resp.status_code == 401


def test_login_inactive_user(client, db):
    user = User(name="Fired", pin_hash=hash_pin("1111"), role="staff", is_active=False)
    db.add(user)
    db.commit()
    resp = client.post("/api/auth/login", json={"name": "Fired", "pin": "1111"})
    assert resp.status_code == 401


def test_get_me(client, admin_token, admin_user):
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Admin"


def test_get_me_no_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code in (401, 403)


def test_get_me_expired_token(client, admin_user):
    payload = {"user_id": admin_user.id, "role": "admin", "exp": datetime.utcnow() - timedelta(seconds=1)}
    expired = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


def test_public_users_list(client, admin_user, staff_user):
    resp = client.get("/api/auth/users")
    assert resp.status_code == 200
    names = [u["name"] for u in resp.json()]
    assert "Admin" in names
    assert "Staff" in names
    assert all(set(u.keys()) == {"id", "name"} for u in resp.json())


def test_health_check(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
```

- [ ] **Step 7: Run all tests**

```bash
cd backend && source venv/bin/activate
pytest tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/auth.py backend/app/seed.py backend/app/schemas.py backend/app/routers/auth.py backend/app/main.py backend/tests/
git commit -m "feat: auth system with PIN login, JWT tokens, and seed data"
```

---

### Task 3: Users + Categories API

**Files:**
- Create: `backend/app/routers/users.py`
- Create: `backend/app/routers/categories.py`
- Modify: `backend/app/main.py` (register routers)
- Create: `backend/tests/test_users.py`
- Create: `backend/tests/test_categories.py`

**Interfaces:**
- Consumes: `User`, `Category` models, `get_current_user`, `require_admin`, Pydantic schemas
- Produces: CRUD endpoints at `/api/users` and `/api/categories`

- [ ] **Step 1: Create users router**

```python
# backend/app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth import require_admin, hash_pin, get_current_user
from app.schemas import UserCreate, UserUpdate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=list[UserOut])
def list_users(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(User)
    if not include_inactive:
        query = query.filter(User.is_active == True)
    return query.order_by(User.name).all()


@router.post("/", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    existing = db.query(User).filter(User.name == data.name, User.is_active == True).first()
    if existing:
        raise HTTPException(400, "User with this name already exists")
    user = User(name=data.name, pin_hash=hash_pin(data.pin), role=data.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int, data: UserUpdate, db: Session = Depends(get_db),
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
    user_id: int, db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    admin_count = db.query(User).filter(User.role == "admin", User.is_active == True).count()
    if user.role == "admin" and admin_count <= 1:
        raise HTTPException(400, "Cannot deactivate the last admin")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user
```

- [ ] **Step 2: Create categories router**

```python
# backend/app/routers/categories.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, User
from app.auth import require_admin
from app.schemas import CategoryCreate, CategoryUpdate, CategoryOut

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).filter(Category.is_active == True).order_by(Category.position).all()


@router.post("/", response_model=CategoryOut, status_code=201)
def create_category(data: CategoryCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    cat = Category(name=data.name, position=data.position)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: int, data: CategoryUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    if data.name is not None:
        cat.name = data.name
    if data.position is not None:
        cat.position = data.position
    if data.is_active is not None:
        cat.is_active = data.is_active
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{cat_id}", response_model=CategoryOut)
def deactivate_category(cat_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    cat.is_active = False
    db.commit()
    db.refresh(cat)
    return cat
```

- [ ] **Step 3: Register routers in main.py**

Add to `main.py`:
```python
from app.routers import users as users_router
from app.routers import categories as categories_router

app.include_router(users_router.router)
app.include_router(categories_router.router)
```

- [ ] **Step 4: Write users tests**

```python
# backend/tests/test_users.py
from app.auth import verify_pin


def test_list_users(client, admin_token, admin_user, staff_user):
    r = client.get("/api/users/", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    names = [u["name"] for u in r.json()]
    assert "Admin" in names
    assert "Staff" in names


def test_list_users_staff_forbidden(client, staff_token):
    r = client.get("/api/users/", headers={"Authorization": f"Bearer {staff_token}"})
    assert r.status_code == 403


def test_create_user(client, admin_token):
    r = client.post("/api/users/", json={"name": "Barista", "pin": "9999", "role": "staff"},
                    headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 201
    assert r.json()["name"] == "Barista"
    assert "pin_hash" not in r.json()


def test_create_duplicate_name(client, admin_token, admin_user):
    r = client.post("/api/users/", json={"name": "Admin", "pin": "1111", "role": "staff"},
                    headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 400


def test_update_user_name(client, admin_token, staff_user):
    r = client.put(f"/api/users/{staff_user.id}", json={"name": "Renamed"},
                   headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"


def test_deactivate_user(client, admin_token, staff_user):
    r = client.delete(f"/api/users/{staff_user.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["is_active"] is False


def test_deactivate_last_admin_fails(client, admin_token, admin_user):
    r = client.delete(f"/api/users/{admin_user.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 400
```

- [ ] **Step 5: Write categories tests**

```python
# backend/tests/test_categories.py

def test_list_categories(client, category_cafe, category_panaderia):
    r = client.get("/api/categories/")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_create_category(admin_client):
    r = admin_client.post("/api/categories/", json={"name": "Bebidas", "position": 2})
    assert r.status_code == 201
    assert r.json()["name"] == "Bebidas"


def test_create_category_staff_forbidden(staff_client):
    r = staff_client.post("/api/categories/", json={"name": "Nope", "position": 0})
    assert r.status_code == 403


def test_update_category(admin_client, category_cafe):
    r = admin_client.put(f"/api/categories/{category_cafe.id}", json={"name": "Café Especial"})
    assert r.status_code == 200
    assert r.json()["name"] == "Café Especial"


def test_deactivate_category(admin_client, category_cafe):
    r = admin_client.delete(f"/api/categories/{category_cafe.id}")
    assert r.status_code == 200
    assert r.json()["is_active"] is False


def test_deactivate_category_not_found(admin_client):
    r = admin_client.delete("/api/categories/999")
    assert r.status_code == 404
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/ -v
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/users.py backend/app/routers/categories.py backend/app/main.py backend/tests/test_users.py backend/tests/test_categories.py
git commit -m "feat: users and categories CRUD API endpoints"
```

---

### Task 4: Items API + Cost Management

**Files:**
- Create: `backend/app/routers/items.py`
- Modify: `backend/app/main.py` (register router)
- Create: `backend/tests/test_items.py`

**Interfaces:**
- Consumes: `Item`, `CostHistory`, `Category` models, `require_admin`
- Produces: CRUD endpoints at `/api/items` with cost history tracking

- [ ] **Step 1: Create items router**

```python
# backend/app/routers/items.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Item, Category, CostHistory, User
from app.auth import require_admin, get_current_user
from app.schemas import ItemCreate, ItemUpdate, ItemOut

router = APIRouter(prefix="/api/items", tags=["items"])


@router.get("/", response_model=list[ItemOut])
def list_items(
    category_id: int | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Item)
    if not include_inactive:
        query = query.filter(Item.is_active == True)
    if category_id:
        query = query.filter(Item.category_id == category_id)
    items = query.order_by(Item.name).all()
    result = []
    for item in items:
        out = ItemOut.model_validate(item)
        out.category_name = item.category.name if item.category else None
        result.append(out)
    return result


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    out = ItemOut.model_validate(item)
    out.category_name = item.category.name if item.category else None
    return out


@router.post("/", response_model=ItemOut, status_code=201)
def create_item(data: ItemCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    cat = db.query(Category).filter(Category.id == data.category_id).first()
    if not cat:
        raise HTTPException(400, "Category not found")
    item = Item(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    out = ItemOut.model_validate(item)
    out.category_name = item.category.name
    return out


@router.put("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, data: ItemUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")

    if data.cost_per_unit is not None and data.cost_per_unit != item.cost_per_unit:
        history = CostHistory(
            item_id=item.id, old_cost=item.cost_per_unit,
            new_cost=data.cost_per_unit, change_source="manual",
        )
        db.add(history)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    out = ItemOut.model_validate(item)
    out.category_name = item.category.name if item.category else None
    return out


@router.delete("/{item_id}", response_model=ItemOut)
def deactivate_item(item_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    item.is_active = False
    db.commit()
    db.refresh(item)
    out = ItemOut.model_validate(item)
    out.category_name = item.category.name if item.category else None
    return out
```

- [ ] **Step 2: Register router in main.py**

```python
from app.routers import items as items_router
app.include_router(items_router.router)
```

- [ ] **Step 3: Write items tests**

```python
# backend/tests/test_items.py
from app.models import CostHistory


def test_list_items(staff_client, item_coffee, item_croissant):
    r = staff_client.get("/api/items/")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_list_items_filter_category(staff_client, item_coffee, item_croissant, category_cafe):
    r = staff_client.get(f"/api/items/?category_id={category_cafe.id}")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Ethiopia Yirgacheffe 1kg"


def test_list_items_unauthenticated(client):
    r = client.get("/api/items/")
    assert r.status_code in (401, 403)


def test_create_item(admin_client, category_cafe):
    r = admin_client.post("/api/items/", json={
        "name": "Colombia Huila 200g", "category_id": category_cafe.id,
        "unit": "unidad", "cost_per_unit": 8.50, "is_produced": False,
    })
    assert r.status_code == 201
    assert r.json()["name"] == "Colombia Huila 200g"
    assert r.json()["category_name"] == "Cafe"


def test_create_item_staff_forbidden(staff_client, category_cafe):
    r = staff_client.post("/api/items/", json={
        "name": "Nope", "category_id": category_cafe.id, "unit": "unidad",
    })
    assert r.status_code == 403


def test_update_item_cost_creates_history(admin_client, item_coffee, db):
    r = admin_client.put(f"/api/items/{item_coffee.id}", json={"cost_per_unit": 20.00})
    assert r.status_code == 200
    assert r.json()["cost_per_unit"] == 20.00
    history = db.query(CostHistory).filter(CostHistory.item_id == item_coffee.id).all()
    assert len(history) == 1
    assert history[0].old_cost == 18.50
    assert history[0].new_cost == 20.00
    assert history[0].change_source == "manual"


def test_update_item_name_no_history(admin_client, item_coffee, db):
    r = admin_client.put(f"/api/items/{item_coffee.id}", json={"name": "New Name"})
    assert r.status_code == 200
    history = db.query(CostHistory).filter(CostHistory.item_id == item_coffee.id).all()
    assert len(history) == 0


def test_deactivate_item(admin_client, item_coffee):
    r = admin_client.delete(f"/api/items/{item_coffee.id}")
    assert r.status_code == 200
    assert r.json()["is_active"] is False


def test_deactivate_item_not_found(admin_client):
    r = admin_client.delete("/api/items/999")
    assert r.status_code == 404
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/ -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/items.py backend/app/main.py backend/tests/test_items.py
git commit -m "feat: items API with cost history tracking"
```

---

### Task 5: Movements API

**Files:**
- Create: `backend/app/routers/movements.py`
- Create: `backend/app/services/costes.py`
- Modify: `backend/app/main.py` (register router)
- Create: `backend/tests/test_movements.py`

**Interfaces:**
- Consumes: `Movement`, `MovementLine`, `Item`, `Setting` models, `get_current_user`, Pydantic schemas
- Produces: CRUD endpoints at `/api/movements`, `calculate_transfer_price(item, markup_pct) -> (cost, markup, transfer_price)`

- [ ] **Step 1: Create cost calculation service**

```python
# backend/app/services/costes.py
from sqlalchemy.orm import Session
from app.models import Item, Setting


def get_markup_pct(db: Session) -> float:
    setting = db.query(Setting).filter(Setting.key == "markup_pct").first()
    return float(setting.value) if setting else 0.0


def calculate_transfer_price(item: Item, markup_pct: float) -> tuple[float, float, float]:
    """Returns (cost_per_unit, effective_markup_pct, transfer_price)."""
    cost = item.cost_per_unit
    if item.is_produced:
        transfer_price = cost * (1 + markup_pct / 100)
        return cost, markup_pct, round(transfer_price, 4)
    return cost, 0.0, cost
```

- [ ] **Step 2: Create movements router**

```python
# backend/app/routers/movements.py
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Movement, MovementLine, Item, User
from app.auth import get_current_user
from app.schemas import MovementCreate, MovementUpdate, MovementOut, MovementLineOut
from app.services.costes import get_markup_pct, calculate_transfer_price

router = APIRouter(prefix="/api/movements", tags=["movements"])


def _build_movement_out(movement: Movement) -> dict:
    lines = []
    total = 0.0
    for line in movement.lines:
        line_total = line.transfer_price_snapshot * line.quantity
        total += line_total
        lines.append({
            "id": line.id,
            "item_id": line.item_id,
            "item_name": line.item.name if line.item else None,
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
        "creator_name": movement.creator.name if movement.creator else None,
        "notes": movement.notes,
        "photo_filename": movement.photo_filename,
        "movement_date": movement.movement_date,
        "created_at": movement.created_at,
        "lines": lines,
        "total_cost": round(total, 2),
    }


@router.get("/")
def list_movements(
    start_date: str | None = None,
    end_date: str | None = None,
    direction: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Movement)
    if start_date:
        query = query.filter(Movement.movement_date >= start_date)
    if end_date:
        query = query.filter(Movement.movement_date <= end_date)
    if direction:
        query = query.filter(Movement.direction == direction)
    movements = query.order_by(Movement.movement_date.desc(), Movement.created_at.desc()).offset(offset).limit(limit).all()
    return [_build_movement_out(m) for m in movements]


@router.get("/{movement_id}")
def get_movement(movement_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    movement = db.query(Movement).filter(Movement.id == movement_id).first()
    if not movement:
        raise HTTPException(404, "Movement not found")
    return _build_movement_out(movement)


@router.post("/", status_code=201)
def create_movement(data: MovementCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if data.direction not in ("BRU1_TO_BRU2", "BRU2_TO_BRU1"):
        raise HTTPException(400, "Invalid direction")
    if not data.lines:
        raise HTTPException(400, "Movement must have at least one line item")

    markup_pct = get_markup_pct(db)

    movement = Movement(
        direction=data.direction,
        created_by=user.id,
        notes=data.notes,
        movement_date=data.movement_date,
    )
    db.add(movement)
    db.flush()

    for line_data in data.lines:
        item = db.query(Item).filter(Item.id == line_data.item_id, Item.is_active == True).first()
        if not item:
            raise HTTPException(400, f"Item {line_data.item_id} not found or inactive")
        cost, markup, transfer = calculate_transfer_price(item, markup_pct)
        line = MovementLine(
            movement_id=movement.id,
            item_id=item.id,
            quantity=line_data.quantity,
            unit=line_data.unit,
            cost_per_unit_snapshot=cost,
            markup_pct_snapshot=markup,
            transfer_price_snapshot=transfer,
        )
        db.add(line)

    db.commit()
    db.refresh(movement)
    return _build_movement_out(movement)


@router.put("/{movement_id}")
def update_movement(
    movement_id: int, data: MovementUpdate,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    movement = db.query(Movement).filter(Movement.id == movement_id).first()
    if not movement:
        raise HTTPException(404, "Movement not found")

    if user.role != "admin":
        if movement.created_by != user.id:
            raise HTTPException(403, "Can only edit your own movements")
        age = datetime.utcnow() - movement.created_at
        if age > timedelta(hours=24):
            raise HTTPException(403, "Can only edit movements within 24 hours")

    if data.direction is not None:
        movement.direction = data.direction
    if data.movement_date is not None:
        movement.movement_date = data.movement_date
    if data.notes is not None:
        movement.notes = data.notes

    if data.lines is not None:
        for line in movement.lines:
            db.delete(line)
        db.flush()

        markup_pct = get_markup_pct(db)
        for line_data in data.lines:
            item = db.query(Item).filter(Item.id == line_data.item_id, Item.is_active == True).first()
            if not item:
                raise HTTPException(400, f"Item {line_data.item_id} not found or inactive")
            cost, markup, transfer = calculate_transfer_price(item, markup_pct)
            line = MovementLine(
                movement_id=movement.id,
                item_id=item.id,
                quantity=line_data.quantity,
                unit=line_data.unit,
                cost_per_unit_snapshot=cost,
                markup_pct_snapshot=markup,
                transfer_price_snapshot=transfer,
            )
            db.add(line)

    db.commit()
    db.refresh(movement)
    return _build_movement_out(movement)


@router.delete("/{movement_id}")
def delete_movement(
    movement_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    movement = db.query(Movement).filter(Movement.id == movement_id).first()
    if not movement:
        raise HTTPException(404, "Movement not found")

    if user.role != "admin":
        if movement.created_by != user.id:
            raise HTTPException(403, "Can only delete your own movements")
        age = datetime.utcnow() - movement.created_at
        if age > timedelta(hours=24):
            raise HTTPException(403, "Can only delete movements within 24 hours")

    db.delete(movement)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 3: Register router in main.py**

```python
from app.routers import movements as movements_router
app.include_router(movements_router.router)
```

- [ ] **Step 4: Write movements tests**

```python
# backend/tests/test_movements.py
from datetime import date, datetime, timedelta
from app.models import Movement, Setting


def _seed_settings(db):
    db.add(Setting(key="markup_pct", value="30"))
    db.commit()


def test_create_movement(staff_client, item_coffee, item_croissant, db):
    _seed_settings(db)
    r = staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2",
        "movement_date": "2026-07-28",
        "notes": "Morning delivery",
        "lines": [
            {"item_id": item_coffee.id, "quantity": 2, "unit": "unidad"},
            {"item_id": item_croissant.id, "quantity": 10, "unit": "unidad"},
        ],
    })
    assert r.status_code == 201
    data = r.json()
    assert data["direction"] == "BRU1_TO_BRU2"
    assert data["creator_name"] == "Staff"
    assert len(data["lines"]) == 2
    assert data["total_cost"] > 0

    coffee_line = next(l for l in data["lines"] if l["item_id"] == item_coffee.id)
    assert coffee_line["markup_pct_snapshot"] == 0.0
    assert coffee_line["transfer_price_snapshot"] == 18.50

    croissant_line = next(l for l in data["lines"] if l["item_id"] == item_croissant.id)
    assert croissant_line["markup_pct_snapshot"] == 30.0
    assert croissant_line["transfer_price_snapshot"] == round(0.85 * 1.30, 4)


def test_create_movement_empty_lines(staff_client, db):
    _seed_settings(db)
    r = staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2", "movement_date": "2026-07-28", "lines": [],
    })
    assert r.status_code == 400


def test_create_movement_invalid_direction(staff_client, item_coffee, db):
    _seed_settings(db)
    r = staff_client.post("/api/movements/", json={
        "direction": "INVALID", "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"}],
    })
    assert r.status_code == 400


def test_create_movement_unauthenticated(client, item_coffee):
    r = client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2", "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"}],
    })
    assert r.status_code in (401, 403)


def test_list_movements(staff_client, item_coffee, db):
    _seed_settings(db)
    staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2", "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"}],
    })
    r = staff_client.get("/api/movements/")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_list_movements_filter_date(staff_client, item_coffee, db):
    _seed_settings(db)
    staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2", "movement_date": "2026-06-15",
        "lines": [{"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"}],
    })
    staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2", "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"}],
    })
    r = staff_client.get("/api/movements/?start_date=2026-07-01&end_date=2026-07-31")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_get_movement_detail(staff_client, item_coffee, db):
    _seed_settings(db)
    create = staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2", "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 3, "unit": "unidad"}],
    })
    mid = create.json()["id"]
    r = staff_client.get(f"/api/movements/{mid}")
    assert r.status_code == 200
    assert r.json()["id"] == mid


def test_delete_own_movement(staff_client, item_coffee, db):
    _seed_settings(db)
    create = staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2", "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"}],
    })
    mid = create.json()["id"]
    r = staff_client.delete(f"/api/movements/{mid}")
    assert r.status_code == 200


def test_delete_other_user_movement_staff_forbidden(client, admin_token, staff_token, item_coffee, db):
    _seed_settings(db)
    create = client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2", "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"}],
    }, headers={"Authorization": f"Bearer {admin_token}"})
    mid = create.json()["id"]
    r = client.delete(f"/api/movements/{mid}", headers={"Authorization": f"Bearer {staff_token}"})
    assert r.status_code == 403


def test_admin_can_delete_any(client, admin_token, staff_token, item_coffee, db):
    _seed_settings(db)
    create = client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2", "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"}],
    }, headers={"Authorization": f"Bearer {staff_token}"})
    mid = create.json()["id"]
    r = client.delete(f"/api/movements/{mid}", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200


def test_delete_after_24h_staff_forbidden(staff_client, item_coffee, db):
    _seed_settings(db)
    create = staff_client.post("/api/movements/", json={
        "direction": "BRU1_TO_BRU2", "movement_date": "2026-07-28",
        "lines": [{"item_id": item_coffee.id, "quantity": 1, "unit": "unidad"}],
    })
    mid = create.json()["id"]
    movement = db.query(Movement).filter(Movement.id == mid).first()
    movement.created_at = datetime.utcnow() - timedelta(hours=25)
    db.commit()
    r = staff_client.delete(f"/api/movements/{mid}")
    assert r.status_code == 403
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/ -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/movements.py backend/app/services/costes.py backend/app/main.py backend/tests/test_movements.py
git commit -m "feat: movements API with cost snapshots and edit/delete rules"
```

---

### Task 6: Photo Upload + Analytics API + Settings + Sync

**Files:**
- Create: `backend/app/routers/photos.py` (or add to movements router)
- Create: `backend/app/routers/analytics.py`
- Create: `backend/app/routers/settings.py`
- Create: `backend/app/routers/sync.py`
- Create: `backend/app/services/analytics.py`
- Modify: `backend/app/main.py` (register routers, static file serving for photos)
- Create: `backend/tests/test_analytics.py`
- Create: `backend/tests/test_settings.py`

**Interfaces:**
- Consumes: All models, `require_admin`, `get_current_user`
- Produces: Photo upload/serve endpoints, analytics endpoints, settings CRUD, Escandallos sync endpoints

- [ ] **Step 1: Add photo endpoints to movements router**

Add to `backend/app/routers/movements.py`:

```python
import os
import uuid
from fastapi import UploadFile, File
from fastapi.responses import FileResponse

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "data/photos")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/{movement_id}/photo")
async def upload_photo(
    movement_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    movement = db.query(Movement).filter(Movement.id == movement_id).first()
    if not movement:
        raise HTTPException(404, "Movement not found")

    content = await file.read()
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(400, "Photo too large (max 5MB)")

    from PIL import Image
    import io

    img = Image.open(io.BytesIO(content))
    img.thumbnail((1200, 1200))

    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    filename = f"{uuid.uuid4().hex}.jpg"
    filepath = os.path.join(UPLOAD_DIR, filename)
    img.save(filepath, "JPEG", quality=80)

    if movement.photo_filename:
        old_path = os.path.join(UPLOAD_DIR, movement.photo_filename)
        if os.path.exists(old_path):
            os.remove(old_path)

    movement.photo_filename = filename
    db.commit()
    return {"filename": filename}


@router.get("/{movement_id}/photo")
def get_photo(movement_id: int, db: Session = Depends(get_db)):
    movement = db.query(Movement).filter(Movement.id == movement_id).first()
    if not movement or not movement.photo_filename:
        raise HTTPException(404, "Photo not found")
    filepath = os.path.join(UPLOAD_DIR, movement.photo_filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "Photo file not found")
    return FileResponse(filepath, media_type="image/jpeg")
```

- [ ] **Step 2: Create analytics service**

```python
# backend/app/services/analytics.py
from datetime import date
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.models import Movement, MovementLine, Item, Category


def get_month_range(year: int, month: int) -> tuple[str, str]:
    start = f"{year}-{month:02d}-01"
    if month == 12:
        end = f"{year + 1}-01-01"
    else:
        end = f"{year}-{month + 1:02d}-01"
    return start, end


def monthly_summary(db: Session, year: int, month: int) -> dict:
    start, end = get_month_range(year, month)
    rows = (
        db.query(func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity))
        .join(Movement)
        .filter(Movement.movement_date >= start, Movement.movement_date < end)
        .scalar()
    )
    count = (
        db.query(func.count(Movement.id))
        .filter(Movement.movement_date >= start, Movement.movement_date < end)
        .scalar()
    )
    return {"total_cost": round(rows or 0, 2), "count": count or 0}


def top_items_by_cost(db: Session, start_date: str, end_date: str, limit: int = 5) -> list[dict]:
    rows = (
        db.query(
            Item.name,
            func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity).label("total"),
        )
        .join(MovementLine, MovementLine.item_id == Item.id)
        .join(Movement, Movement.id == MovementLine.movement_id)
        .filter(Movement.movement_date >= start_date, Movement.movement_date <= end_date)
        .group_by(Item.id, Item.name)
        .order_by(func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity).desc())
        .limit(limit)
        .all()
    )
    return [{"name": r[0], "total": round(r[1], 2)} for r in rows]


def top_items_by_quantity(db: Session, start_date: str, end_date: str, limit: int = 5) -> list[dict]:
    rows = (
        db.query(
            Item.name,
            func.sum(MovementLine.quantity).label("total"),
        )
        .join(MovementLine, MovementLine.item_id == Item.id)
        .join(Movement, Movement.id == MovementLine.movement_id)
        .filter(Movement.movement_date >= start_date, Movement.movement_date <= end_date)
        .group_by(Item.id, Item.name)
        .order_by(func.sum(MovementLine.quantity).desc())
        .limit(limit)
        .all()
    )
    return [{"name": r[0], "total": round(r[1], 2)} for r in rows]


def category_breakdown(db: Session, start_date: str, end_date: str) -> list[dict]:
    rows = (
        db.query(
            Category.name,
            func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity).label("total"),
        )
        .join(Item, Item.category_id == Category.id)
        .join(MovementLine, MovementLine.item_id == Item.id)
        .join(Movement, Movement.id == MovementLine.movement_id)
        .filter(Movement.movement_date >= start_date, Movement.movement_date <= end_date)
        .group_by(Category.id, Category.name)
        .order_by(func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity).desc())
        .all()
    )
    return [{"category": r[0], "total": round(r[1], 2)} for r in rows]


def monthly_totals(db: Session, months: int = 12) -> list[dict]:
    today = date.today()
    results = []
    for i in range(months):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        summary = monthly_summary(db, y, m)
        results.append({"year": y, "month": m, **summary})
    results.reverse()
    return results


def category_comparison(db: Session, year: int, month: int) -> list[dict]:
    """Compare category totals this month vs last month."""
    curr_start, curr_end = get_month_range(year, month)
    prev_month = month - 1
    prev_year = year
    if prev_month == 0:
        prev_month = 12
        prev_year -= 1
    prev_start, prev_end = get_month_range(prev_year, prev_month)

    current = {r["category"]: r["total"] for r in category_breakdown(db, curr_start, curr_end)}
    previous = {r["category"]: r["total"] for r in category_breakdown(db, prev_start, prev_end)}

    all_cats = set(list(current.keys()) + list(previous.keys()))
    result = []
    for cat in sorted(all_cats):
        curr = current.get(cat, 0)
        prev = previous.get(cat, 0)
        pct = ((curr - prev) / prev * 100) if prev > 0 else (100 if curr > 0 else 0)
        result.append({"category": cat, "current": curr, "previous": prev, "change_pct": round(pct, 1)})
    return result
```

- [ ] **Step 3: Create analytics router**

```python
# backend/app/routers/analytics.py
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth import require_admin
from app.services import analytics as svc

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary")
def get_summary(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    today = date.today()
    curr = svc.monthly_summary(db, today.year, today.month)
    prev_m = today.month - 1
    prev_y = today.year
    if prev_m == 0:
        prev_m = 12
        prev_y -= 1
    prev = svc.monthly_summary(db, prev_y, prev_m)

    curr_start, curr_end = svc.get_month_range(today.year, today.month)
    change_pct = ((curr["total_cost"] - prev["total_cost"]) / prev["total_cost"] * 100) if prev["total_cost"] > 0 else 0

    return {
        "current_month_cost": curr["total_cost"],
        "previous_month_cost": prev["total_cost"],
        "cost_change_pct": round(change_pct, 1),
        "current_month_count": curr["count"],
        "previous_month_count": prev["count"],
        "top_items_by_cost": svc.top_items_by_cost(db, curr_start, curr_end),
        "top_items_by_quantity": svc.top_items_by_quantity(db, curr_start, curr_end),
        "category_comparison": svc.category_comparison(db, today.year, today.month),
    }


@router.get("/monthly")
def get_monthly(months: int = 12, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return svc.monthly_totals(db, months)


@router.get("/categories")
def get_categories(
    start_date: str = Query(...), end_date: str = Query(...),
    db: Session = Depends(get_db), _: User = Depends(require_admin),
):
    return svc.category_breakdown(db, start_date, end_date)


@router.get("/items")
def get_item_trends(
    start_date: str = Query(...), end_date: str = Query(...),
    item_ids: str | None = None,
    db: Session = Depends(get_db), _: User = Depends(require_admin),
):
    from sqlalchemy import func
    from app.models import Movement, MovementLine, Item

    query = (
        db.query(
            Item.name,
            Movement.movement_date,
            func.sum(MovementLine.quantity).label("total_qty"),
            func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity).label("total_cost"),
        )
        .join(MovementLine, MovementLine.item_id == Item.id)
        .join(Movement, Movement.id == MovementLine.movement_id)
        .filter(Movement.movement_date >= start_date, Movement.movement_date <= end_date)
    )

    if item_ids:
        ids = [int(i) for i in item_ids.split(",")]
        query = query.filter(Item.id.in_(ids))

    rows = query.group_by(Item.name, Movement.movement_date).order_by(Movement.movement_date).all()
    return [{"name": r[0], "date": r[1], "quantity": round(r[2], 2), "cost": round(r[3], 2)} for r in rows]


@router.get("/direction")
def get_direction_split(
    start_date: str = Query(...), end_date: str = Query(...),
    db: Session = Depends(get_db), _: User = Depends(require_admin),
):
    from sqlalchemy import func
    from app.models import Movement, MovementLine

    rows = (
        db.query(
            Movement.direction,
            func.sum(MovementLine.transfer_price_snapshot * MovementLine.quantity).label("total"),
        )
        .join(MovementLine, MovementLine.movement_id == Movement.id)
        .filter(Movement.movement_date >= start_date, Movement.movement_date <= end_date)
        .group_by(Movement.direction)
        .all()
    )
    return {r[0]: round(r[1], 2) for r in rows}
```

- [ ] **Step 4: Create settings router**

```python
# backend/app/routers/settings.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Setting, User
from app.auth import require_admin
from app.schemas import SettingOut, SettingUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/", response_model=list[SettingOut])
def list_settings(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(Setting).all()


@router.put("/{key}", response_model=SettingOut)
def update_setting(key: str, data: SettingUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting:
        raise HTTPException(404, "Setting not found")
    setting.value = data.value
    db.commit()
    db.refresh(setting)
    return setting
```

- [ ] **Step 5: Create sync router**

```python
# backend/app/routers/sync.py
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Item, Setting, CostHistory, User
from app.auth import require_admin

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/escandallos")
def pull_escandallos_costs(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    url_setting = db.query(Setting).filter(Setting.key == "escandallos_api_url").first()
    if not url_setting:
        raise HTTPException(400, "Escandallos API URL not configured")

    try:
        resp = httpx.get(f"{url_setting.value}/api/ingredientes", timeout=15)
        resp.raise_for_status()
        ingredients = resp.json()
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch from Escandallos: {str(e)}")

    items = db.query(Item).filter(Item.is_active == True, Item.escandallos_name.isnot(None)).all()

    matches = []
    for item in items:
        for ing in ingredients:
            if ing.get("nombre", "").lower().strip() == item.escandallos_name.lower().strip():
                new_cost = ing.get("precio_unitario", ing.get("coste_por_unidad", 0))
                if new_cost and new_cost != item.cost_per_unit:
                    matches.append({
                        "item_id": item.id,
                        "item_name": item.name,
                        "escandallos_name": item.escandallos_name,
                        "current_cost": item.cost_per_unit,
                        "new_cost": round(new_cost, 4),
                    })
                break

    return {"matches": matches}


@router.post("/confirm")
def confirm_sync(
    updates: list[dict], db: Session = Depends(get_db), _: User = Depends(require_admin),
):
    applied = 0
    for upd in updates:
        item = db.query(Item).filter(Item.id == upd["item_id"]).first()
        if not item:
            continue
        history = CostHistory(
            item_id=item.id, old_cost=item.cost_per_unit,
            new_cost=upd["new_cost"], change_source="sync",
        )
        db.add(history)
        item.cost_per_unit = upd["new_cost"]
        applied += 1
    db.commit()
    return {"applied": applied}
```

Add `httpx` to `requirements.txt` (already there for tests).

- [ ] **Step 6: Register all new routers in main.py**

```python
from app.routers import analytics as analytics_router
from app.routers import settings as settings_router
from app.routers import sync as sync_router

app.include_router(analytics_router.router)
app.include_router(settings_router.router)
app.include_router(sync_router.router)
```

- [ ] **Step 7: Write analytics + settings tests**

```python
# backend/tests/test_analytics.py
from app.models import Movement, MovementLine, Setting


def _create_movement_with_line(db, user, item, date_str, qty=1, direction="BRU1_TO_BRU2"):
    m = Movement(direction=direction, created_by=user.id, movement_date=date_str)
    db.add(m)
    db.flush()
    line = MovementLine(
        movement_id=m.id, item_id=item.id, quantity=qty, unit="unidad",
        cost_per_unit_snapshot=item.cost_per_unit, markup_pct_snapshot=0,
        transfer_price_snapshot=item.cost_per_unit,
    )
    db.add(line)
    db.commit()
    return m


def test_analytics_summary(admin_client, admin_user, item_coffee, db):
    db.add(Setting(key="markup_pct", value="0"))
    _create_movement_with_line(db, admin_user, item_coffee, "2026-07-15", qty=3)
    r = admin_client.get("/api/analytics/summary")
    assert r.status_code == 200
    data = r.json()
    assert "current_month_cost" in data
    assert "category_comparison" in data


def test_analytics_monthly(admin_client, admin_user, item_coffee, db):
    db.add(Setting(key="markup_pct", value="0"))
    _create_movement_with_line(db, admin_user, item_coffee, "2026-07-15")
    r = admin_client.get("/api/analytics/monthly?months=6")
    assert r.status_code == 200
    assert len(r.json()) == 6


def test_analytics_categories(admin_client, admin_user, item_coffee, db):
    db.add(Setting(key="markup_pct", value="0"))
    _create_movement_with_line(db, admin_user, item_coffee, "2026-07-15")
    r = admin_client.get("/api/analytics/categories?start_date=2026-07-01&end_date=2026-07-31")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_analytics_direction(admin_client, admin_user, item_coffee, db):
    db.add(Setting(key="markup_pct", value="0"))
    _create_movement_with_line(db, admin_user, item_coffee, "2026-07-15", direction="BRU1_TO_BRU2")
    _create_movement_with_line(db, admin_user, item_coffee, "2026-07-16", direction="BRU2_TO_BRU1")
    r = admin_client.get("/api/analytics/direction?start_date=2026-07-01&end_date=2026-07-31")
    assert r.status_code == 200
    data = r.json()
    assert "BRU1_TO_BRU2" in data
    assert "BRU2_TO_BRU1" in data


def test_analytics_staff_forbidden(staff_client):
    r = staff_client.get("/api/analytics/summary")
    assert r.status_code == 403
```

```python
# backend/tests/test_settings.py
from app.models import Setting


def test_list_settings(admin_client, db):
    db.add(Setting(key="markup_pct", value="30"))
    db.commit()
    r = admin_client.get("/api/settings/")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_update_setting(admin_client, db):
    db.add(Setting(key="markup_pct", value="30"))
    db.commit()
    r = admin_client.put("/api/settings/markup_pct", json={"value": "25"})
    assert r.status_code == 200
    assert r.json()["value"] == "25"


def test_update_setting_not_found(admin_client):
    r = admin_client.put("/api/settings/nonexistent", json={"value": "x"})
    assert r.status_code == 404


def test_settings_staff_forbidden(staff_client):
    r = staff_client.get("/api/settings/")
    assert r.status_code == 403
```

- [ ] **Step 8: Run all tests**

```bash
pytest tests/ -v
```

- [ ] **Step 9: Commit**

```bash
git add backend/app/routers/ backend/app/services/ backend/app/main.py backend/tests/
git commit -m "feat: photo upload, analytics, settings, and Escandallos sync APIs"
```

---

### Task 7: Frontend Scaffold + Shared Components

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.ts`
- Create: `frontend/postcss.config.mjs`
- Create: `frontend/eslint.config.mjs`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/globals.css`
- Create: `frontend/src/components/AppShell.tsx`
- Create: `frontend/src/components/AuthGuard.tsx`
- Create: `frontend/src/components/BottomNav.tsx`
- Create: `frontend/src/components/PinPad.tsx`
- Create: `frontend/src/components/Toast.tsx`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/format.ts`
- Create: `frontend/public/manifest.json`
- Create: `frontend/public/logo/` (copy from Branding/)

**Interfaces:**
- Consumes: Brand assets from `Branding/`
- Produces: `apiFetch<T>()`, TypeScript interfaces, shared components, layout

Follow the **exact same patterns** as the Checklists frontend. Key differences:
- localStorage key: `bru_movements_token` (not `bru_checklist_token`)
- API default port: `http://localhost:8002`
- App title: "BRU Movimientos"
- PWA name: "BRU Movimientos"
- BottomNav tabs: Inicio, Movimientos, Admin (admin only)
- `format.ts`: CHF currency formatter, quantity formatter

- [ ] **Step 1: Create package.json and install dependencies**

```json
{
  "name": "bru-movements-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "chart.js": "^4.4.0",
    "next": "16.2.10",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.10",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

```bash
cd frontend && npm install
```

- [ ] **Step 2: Create config files**

Create `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs` — identical to Checklists (see Task 1 analysis). The `tsconfig.json` uses `@/*` path alias to `./src/*`.

- [ ] **Step 3: Create layout.tsx**

Same pattern as Checklists but with title "BRU Movimientos" and apple-mobile-web-app-title "BRU Movimientos".

- [ ] **Step 4: Create globals.css**

Same as Checklists — `:root` variables, `@theme inline`, toast/checkbox/progress animations, safe-area-bottom.

- [ ] **Step 5: Create api.ts**

Same as Checklists but with `bru_movements_token` as the localStorage key and default port `http://localhost:8002`. Must also handle non-JSON responses (for photo downloads) — add a `apiFetchRaw()` variant.

- [ ] **Step 6: Create types.ts**

```typescript
export interface User {
  id: number;
  name: string;
  role: string;
  is_active: boolean;
}

export interface LoginUser {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  position: number;
  is_active: boolean;
}

export interface Item {
  id: number;
  name: string;
  category_id: number;
  category_name?: string;
  unit: string;
  cost_per_unit: number;
  is_produced: boolean;
  escandallos_name?: string;
  is_active: boolean;
}

export interface MovementLine {
  id: number;
  item_id: number;
  item_name?: string;
  quantity: number;
  unit: string;
  cost_per_unit_snapshot: number;
  markup_pct_snapshot: number;
  transfer_price_snapshot: number;
}

export interface Movement {
  id: number;
  direction: string;
  created_by: number;
  creator_name?: string;
  notes?: string;
  photo_filename?: string;
  movement_date: string;
  created_at: string;
  lines: MovementLine[];
  total_cost: number;
}

export interface AnalyticsSummary {
  current_month_cost: number;
  previous_month_cost: number;
  cost_change_pct: number;
  current_month_count: number;
  previous_month_count: number;
  top_items_by_cost: { name: string; total: number }[];
  top_items_by_quantity: { name: string; total: number }[];
  category_comparison: { category: string; current: number; previous: number; change_pct: number }[];
}

export interface Setting {
  key: string;
  value: string;
}
```

- [ ] **Step 7: Create format.ts**

```typescript
export function formatCHF(amount: number): string {
  return `CHF ${amount.toFixed(2)}`;
}

export function formatQuantity(qty: number, unit: string): string {
  const rounded = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
  return `${rounded} ${unit}`;
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
```

- [ ] **Step 8: Create shared components**

Create `AppShell.tsx`, `AuthGuard.tsx`, `BottomNav.tsx`, `PinPad.tsx`, `Toast.tsx` — same patterns as Checklists with:
- `bru_movements_token` localStorage key
- BottomNav tabs: Inicio (home icon), Movimientos (list icon), Admin (gear icon — admin only)
- AppShell header shows logo and user name + logout

- [ ] **Step 9: Create manifest.json and copy logo assets**

```json
{
  "name": "BRU Movimientos",
  "short_name": "BRU Mov",
  "description": "Stock movement tracker for BRU coffee shop",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#861A22",
  "theme_color": "#861A22",
  "orientation": "portrait",
  "icons": [
    {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
    {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}
  ]
}
```

Copy logo SVGs and PWA icons from the Checklists project or generate from Branding assets.

- [ ] **Step 10: Verify frontend compiles**

```bash
cd frontend && npm run build
```

- [ ] **Step 11: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffold with shared components and PWA config"
```

---

### Task 8: Login Page + Home Page + New Movement Form

**Files:**
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/app/movimientos/nuevo/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `AppShell`, `AuthGuard`, `PinPad`, `Toast`, types
- Produces: Login flow, home page with today's summary, new movement form

- [ ] **Step 1: Create login page**

Same pattern as Checklists — name grid + PIN pad modal overlay. Uses `bru_movements_token`. Header shows BRU logo. Heading: "¿Quién registra?"

- [ ] **Step 2: Create home page**

Home page shows:
- "Nuevo Movimiento" button (prominent, top of page)
- Today's movement summary (count, total cost)
- List of today's movements with direction badge, line count, total

Uses `AppShell` wrapper. Fetches `GET /api/movements?start_date=<today>&end_date=<today>`.

- [ ] **Step 3: Create new movement form**

The movement form is the core staff workflow. It needs to be fast and mobile-friendly:
- Direction selector (BRU1 → BRU2 default, with toggle for reverse)
- Date picker (defaults to today)
- Item search/select with quantity input
- Running total at bottom
- Photo capture button (opens camera on mobile)
- Submit button

Flow:
1. Staff selects direction (toggle, default BRU1→BRU2)
2. Taps "Añadir artículo" to add line items
3. For each line: search/select item from a filterable list, enter quantity
4. Running total updates in real-time
5. Optional: tap camera icon to attach photo
6. Optional: add notes
7. Submit → `POST /api/movements` → redirect to home with success toast

Items are loaded once from `GET /api/items` and filtered client-side by search text and category.

- [ ] **Step 4: Test in browser**

```bash
# Terminal 1 — backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8002

# Terminal 2 — frontend
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8002 npm run dev
```

Test: login with Admin/0000, create a movement, verify it appears on home page.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/
git commit -m "feat: login page, home page, and new movement form"
```

---

### Task 9: Movement List + Detail Pages

**Files:**
- Create: `frontend/src/app/movimientos/page.tsx`
- Create: `frontend/src/app/movimientos/[id]/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `AppShell`, movement types, `formatCHF`, `formatDate`
- Produces: Movement history list with filters, movement detail/edit view

- [ ] **Step 1: Create movement list page**

`/movimientos` — shows all movements with:
- Date range filter (quick buttons: Hoy, Esta semana, Este mes, or custom)
- Direction filter toggle (Todos, BRU1→BRU2, BRU2→BRU1)
- Each movement card shows: date, direction badge, creator name, line count, total cost, photo indicator
- Tap a card to navigate to detail page
- Sorted by date descending

- [ ] **Step 2: Create movement detail page**

`/movimientos/[id]` — shows:
- Movement header: date, direction, creator, timestamp
- Photo (if attached — shows thumbnail, tap to view full)
- Notes (if any)
- Line items table: item name, quantity, unit, cost, markup, transfer price
- Total cost at bottom
- Edit/Delete buttons (if user has permission per business rules)
- Edit mode: inline editing of lines, direction, date, notes

- [ ] **Step 3: Test in browser**

Navigate through list → detail → edit flow. Test filters, photo display, edit/delete permissions.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/movimientos/
git commit -m "feat: movement list with filters and detail/edit page"
```

---

### Task 10: Admin Pages

**Files:**
- Create: `frontend/src/app/admin/layout.tsx`
- Create: `frontend/src/app/admin/page.tsx`
- Create: `frontend/src/app/admin/items/page.tsx`
- Create: `frontend/src/app/admin/categories/page.tsx`
- Create: `frontend/src/app/admin/team/page.tsx`
- Create: `frontend/src/app/admin/settings/page.tsx`
- Create: `frontend/src/app/admin/analytics/page.tsx`
- Create: `frontend/src/components/charts/` (Chart.js wrappers)

**Interfaces:**
- Consumes: `apiFetch`, all types, analytics API, settings API, Chart.js
- Produces: Full admin section with dashboard, CRUD pages, and analytics

- [ ] **Step 1: Create admin layout**

Admin layout with sub-navigation tabs: Dashboard, Analíticas, Artículos, Categorías, Equipo, Ajustes. Role check — redirects non-admins.

- [ ] **Step 2: Create admin dashboard**

`/admin` — shows:
- Key metrics cards: Total cost this month (with % change badge), total movements count
- Top 5 items by cost (list with bars)
- Top 5 items by quantity (list with bars)
- Category comparison table: category name, this month cost, last month cost, % change with color indicator (green=down, red=up)

Data from `GET /api/analytics/summary`.

- [ ] **Step 3: Create Chart.js wrapper components**

```typescript
// frontend/src/components/charts/BarChart.tsx
// frontend/src/components/charts/DoughnutChart.tsx
// frontend/src/components/charts/LineChart.tsx
```

Each chart component:
- Accepts data + labels as props
- Uses `useEffect` + `useRef` to manage Chart.js canvas lifecycle
- Cleans up chart instance on unmount
- Uses brand colors: maroon (#861A22), warm beige (#D4C3A5), supporting palette
- Responsive, mobile-friendly sizing

- [ ] **Step 4: Create analytics page**

`/admin/analytics` — shows:
- Period selector (dropdown: Este mes, Último mes, Últimos 3 meses, Últimos 6 meses, Últimos 12 meses)
- Monthly cost bar chart (last 12 months)
- Category breakdown doughnut chart
- Direction split (BRU1→BRU2 vs BRU2→BRU1)
- Markup impact (total COGS vs total markup)
- Item trends line chart (with item multi-select filter)

Data from the analytics API endpoints.

- [ ] **Step 5: Create items management page**

`/admin/items` — table with:
- Search bar (filters by name)
- Category filter dropdown
- Each row: name, category, unit, cost, produced badge, active/inactive toggle
- "Nuevo artículo" button → modal form
- Inline edit for cost (pencil icon)
- "Sincronizar con Escandallos" button (calls sync API, shows preview, confirm)

- [ ] **Step 6: Create categories management page**

`/admin/categories` — simple list with:
- Drag-to-reorder (or position number input)
- Inline name editing
- Add/deactivate buttons

- [ ] **Step 7: Create team management page**

`/admin/team` — same pattern as Checklists:
- User list (name, role badge, active status)
- Add user modal (name + PIN + role)
- Edit user (change name, reset PIN, change role)
- Deactivate user

- [ ] **Step 8: Create settings page**

`/admin/settings` — shows:
- Markup percentage input (with save button)
- Escandallos API URL input (with test connection button)

- [ ] **Step 9: Test all admin pages in browser**

Navigate through every admin page. Test CRUD operations, chart rendering, sync preview, settings save.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/app/admin/ frontend/src/components/charts/
git commit -m "feat: admin pages with dashboard, analytics charts, and CRUD management"
```

---

### Task 11: Polish + Deploy

**Files:**
- Modify: Various frontend files (responsive tweaks, loading states, error handling)
- Create: `.gitignore`
- Create: `frontend/.env.local` (template)

**Interfaces:**
- Consumes: Everything from previous tasks
- Produces: Deployed app on Vercel + Render + Neon

- [ ] **Step 1: Create .gitignore**

```
# Python
__pycache__/
*.pyc
venv/
*.db

# Node
node_modules/
.next/
out/

# Environment
.env
.env.local
*.local

# IDE
.vscode/
.idea/

# OS
.DS_Store

# Uploads
backend/data/photos/
```

- [ ] **Step 2: Create frontend .env.local template**

```
NEXT_PUBLIC_API_URL=http://localhost:8002
```

- [ ] **Step 3: Final polish — loading states, error boundaries, empty states**

Ensure every page has:
- Loading spinner while fetching data (maroon spinner, same as Checklists)
- Error toast on API failures
- Empty state messages in Spanish ("No hay movimientos hoy", "No hay artículos", etc.)
- Touch-friendly tap targets (min 44px)
- iOS safe area insets on bottom nav

- [ ] **Step 4: Test full flow end-to-end**

```bash
# Start backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8002

# Start frontend
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8002 npm run dev
```

Test:
1. Login as Admin/0000
2. Create categories (Cafe, Panadería, Bebidas)
3. Create items (coffee types, croissants, drinks)
4. Create a movement BRU1→BRU2 with multiple items + photo
5. View movement list, filter by date
6. View movement detail, verify cost calculations
7. Check admin dashboard metrics
8. Check analytics charts
9. Create a staff user, login as staff, verify limited access
10. Test on mobile viewport (Chrome DevTools)

- [ ] **Step 5: Run backend tests**

```bash
cd backend && source venv/bin/activate && pytest tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 6: Deploy to Neon**

1. Create free Neon project (EU Frankfurt)
2. Copy connection string
3. Run migration against Neon:
```bash
DATABASE_URL="postgresql://..." alembic upgrade head
```

- [ ] **Step 7: Deploy backend to Render**

1. Connect GitHub repo to Render
2. Create web service from `render.yaml`
3. Set env vars: `DATABASE_URL` (Neon URL), `CORS_ORIGINS` (Vercel URL), `SECRET_KEY` (auto-generated)
4. Deploy and verify: `curl https://bru-movements-api.onrender.com/health`

- [ ] **Step 8: Deploy frontend to Vercel**

1. Import repo to Vercel
2. Set root directory to `frontend/`
3. Set env var: `NEXT_PUBLIC_API_URL` = Render backend URL
4. Deploy and verify

- [ ] **Step 9: Add deploy info to CLAUDE.md**

Update the Deploy section with actual URLs and deploy trigger commands.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "feat: final polish and deployment configuration"
```

---

## File Map Summary

| File | Responsibility |
|---|---|
| `backend/app/database.py` | SQLAlchemy engine, dual SQLite/Postgres |
| `backend/app/models.py` | 7 models: User, Category, Item, Movement, MovementLine, Setting, CostHistory |
| `backend/app/auth.py` | PIN hash, JWT, get_current_user, require_admin |
| `backend/app/schemas.py` | All Pydantic request/response schemas |
| `backend/app/seed.py` | Default admin + settings |
| `backend/app/main.py` | FastAPI app, CORS, routers, startup seed |
| `backend/app/routers/auth.py` | Login, me, public user list |
| `backend/app/routers/users.py` | User CRUD (admin) |
| `backend/app/routers/categories.py` | Category CRUD |
| `backend/app/routers/items.py` | Item CRUD with cost history |
| `backend/app/routers/movements.py` | Movement CRUD + photo upload/serve |
| `backend/app/routers/analytics.py` | Dashboard + chart data endpoints |
| `backend/app/routers/settings.py` | Settings CRUD |
| `backend/app/routers/sync.py` | Escandallos cost sync |
| `backend/app/services/costes.py` | Transfer price calculation |
| `backend/app/services/analytics.py` | Aggregation queries |
| `frontend/src/lib/api.ts` | API client with auth |
| `frontend/src/lib/types.ts` | TypeScript interfaces |
| `frontend/src/lib/format.ts` | CHF/quantity/date formatters |
| `frontend/src/components/*.tsx` | AppShell, AuthGuard, BottomNav, PinPad, Toast |
| `frontend/src/components/charts/*.tsx` | Chart.js wrapper components |
| `frontend/src/app/login/page.tsx` | Name grid + PIN login |
| `frontend/src/app/page.tsx` | Home — new movement + today's summary |
| `frontend/src/app/movimientos/*.tsx` | Movement list, form, detail |
| `frontend/src/app/admin/*.tsx` | Dashboard, analytics, items, categories, team, settings |
