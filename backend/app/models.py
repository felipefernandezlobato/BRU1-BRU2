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
    unit: Mapped[str] = mapped_column(sa.String(20))
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
    direction: Mapped[str] = mapped_column(sa.String(20))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    photo_filename: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    movement_date: Mapped[str] = mapped_column(sa.String(10))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    creator: Mapped["User"] = relationship(back_populates="movements")
    lines: Mapped[list["MovementLine"]] = relationship(
        back_populates="movement",
        cascade="all, delete-orphan",
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
    change_source: Mapped[str] = mapped_column(sa.String(20))

    item: Mapped["Item"] = relationship(back_populates="cost_history")
