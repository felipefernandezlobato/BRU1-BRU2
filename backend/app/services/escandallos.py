"""Read ingredient costs straight from the Escandallos production database.

Escandallos exposes ingredients only behind an authenticated API, so this app
reads its Postgres directly instead, via ESCANDALLOS_DATABASE_URL. Nothing here
writes: the queries are SELECT-only.

`coste_por_unidad_uso` is a *computed* value upstream, not a stored column, so
the formula is ported verbatim from Escandallos'
backend/app/services/costes.py. The conversion table is identical to the unit
system documented in CLAUDE.md. If either changes upstream this module has to
change with it — that is the cost of reading the database rather than the API.
"""
import os
from typing import Any, Mapping

import sqlalchemy as sa

# Ported from Escandallos backend/app/services/conversiones.py
CONVERSIONES: dict[str, dict[str, float]] = {
    "kg": {"kg": 1, "g": 1000, "mg": 1_000_000},
    "g": {"kg": 0.001, "g": 1, "mg": 1000},
    "mg": {"kg": 0.000001, "g": 0.001, "mg": 1},
    "litro": {"litro": 1, "ml": 1000, "cl": 100},
    "ml": {"litro": 0.001, "ml": 1, "cl": 0.1},
    "cl": {"litro": 0.01, "ml": 10, "cl": 1},
    "unidad": {"unidad": 1},
}

_INGREDIENT_QUERY = sa.text(
    """
    SELECT id, nombre, categoria_id, unidad_compra, cantidad_compra,
           precio_compra, unidad_uso, merma_porcentaje, activo,
           frozen_origen_id
    FROM ingredientes
    """
)


class EscandallosNotConfigured(RuntimeError):
    """ESCANDALLOS_DATABASE_URL is not set, so there is nothing to read."""


def convertir(cantidad: float, de_unidad: str, a_unidad: str) -> float:
    de = (de_unidad or "").lower()
    a = (a_unidad or "").lower()
    if de == a:
        return cantidad
    if de not in CONVERSIONES or a not in CONVERSIONES[de]:
        raise ValueError(f"No se puede convertir de '{de_unidad}' a '{a_unidad}'")
    return cantidad * CONVERSIONES[de][a]


def coste_por_unidad_uso(ing: Mapping[str, Any]) -> float:
    """Cost of one `unidad_uso`, including merma. Returns 0.0 if uncomputable.

    Upstream raises on a merma of 100% or more; here a bad row must not break a
    whole sync, so it yields 0.0 and the caller skips it.
    """
    try:
        cantidad_uso = convertir(
            ing["cantidad_compra"], ing["unidad_compra"], ing["unidad_uso"]
        )
    except (ValueError, TypeError):
        return 0.0
    if not cantidad_uso or cantidad_uso <= 0:
        return 0.0
    factor_merma = 1 - ((ing["merma_porcentaje"] or 0.0) / 100)
    if factor_merma <= 0:
        return 0.0
    return (ing["precio_compra"] or 0.0) / cantidad_uso / factor_merma


def resolve_cost(ing: Mapping[str, Any], by_id: Mapping[int, Mapping[str, Any]]) -> float:
    """Cost for one ingredient, following frozen items back to their origin bean.

    Frozen coffee is stored upstream with precio_compra = 0.00; the real cost
    lives on the bean referenced by frozen_origen_id, which is the convention
    this app's `Frozen *` items already follow.
    """
    cost = coste_por_unidad_uso(ing)
    if cost > 0:
        return cost

    origin_id = ing.get("frozen_origen_id")
    if origin_id and origin_id != ing["id"] and origin_id in by_id:
        return coste_por_unidad_uso(by_id[origin_id])
    return 0.0


def _engine(url: str | None = None) -> sa.Engine:
    url = url or os.environ.get("ESCANDALLOS_DATABASE_URL", "")
    if not url:
        raise EscandallosNotConfigured(
            "ESCANDALLOS_DATABASE_URL is not set"
        )
    # Built per call rather than cached at import so the app boots without the
    # variable set and picks up a change without a restart. Sync is a rare,
    # admin-triggered action, so the connection cost does not matter.
    return sa.create_engine(url, pool_pre_ping=True)


def ingredient_costs(url: str | None = None) -> list[dict]:
    """Active ingredients with their computed cost per unidad_uso."""
    engine = _engine(url)
    try:
        with engine.connect() as conn:
            rows = [dict(r._mapping) for r in conn.execute(_INGREDIENT_QUERY)]
    finally:
        engine.dispose()

    by_id = {r["id"]: r for r in rows}
    return [
        {
            "nombre": r["nombre"],
            "categoria_id": r["categoria_id"],
            "unidad_uso": r["unidad_uso"],
            "cost": round(resolve_cost(r, by_id), 6),
        }
        for r in rows
        if r["activo"]
    ]


def ingredient_count(url: str | None = None) -> int:
    """Row count, used by the connection test."""
    engine = _engine(url)
    try:
        with engine.connect() as conn:
            return conn.execute(sa.text("SELECT count(*) FROM ingredientes")).scalar() or 0
    finally:
        engine.dispose()
