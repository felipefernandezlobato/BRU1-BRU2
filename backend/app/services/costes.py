from sqlalchemy.orm import Session
from app.models import Item, Setting


def get_markup_pct(db: Session) -> float:
    setting = db.query(Setting).filter(Setting.key == "markup_pct").first()
    return float(setting.value) if setting else 0.0


def calculate_transfer_price(item: Item, markup_pct: float) -> tuple[float, float, float]:
    cost = item.cost_per_unit
    if item.is_produced:
        transfer_price = cost * (1 + markup_pct / 100)
        return cost, markup_pct, round(transfer_price, 4)
    return cost, 0.0, cost
