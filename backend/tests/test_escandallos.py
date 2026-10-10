"""Tests for the Escandallos cost reader.

The query path runs against a SQLite table shaped like Escandallos'
`ingredientes`, so the SQL and the frozen-origin resolution are covered without
needing the production credential.
"""
import pytest
import sqlalchemy as sa

from app.services.escandallos import (
    EscandallosNotConfigured,
    convertir,
    coste_por_unidad_uso,
    ingredient_costs,
    ingredient_count,
    resolve_cost,
)

DDL = """
CREATE TABLE ingredientes (
    id INTEGER PRIMARY KEY,
    nombre TEXT,
    categoria_id INTEGER,
    unidad_compra TEXT,
    cantidad_compra REAL,
    precio_compra REAL,
    unidad_uso TEXT,
    merma_porcentaje REAL,
    activo BOOLEAN,
    frozen_origen_id INTEGER
)
"""

ROWS = [
    # 6x1L of milk for 9.00 -> 1.50 per litro
    (1, "Leche entera", 2, "litro", 6, 9.0, "litro", 0, 1, None),
    # a 200g bag sold as one unit -> cost is the bag price
    (2, "200g DABOV Mexico La Perla", 5, "unidad", 1, 6.68, "unidad", 0, 1, None),
    # frozen tube: no price upstream, real cost lives on row 2
    (3, "Frozen Mexico La Perla Bru1", 5, "unidad", 1, 0.0, "unidad", 0, 1, 2),
    # 1kg of flour for 2.00 used in grams, 10% merma -> 0.002 / 0.9
    (4, "Harina", 3, "kg", 1, 2.0, "g", 10, 1, None),
    # inactive, must not be returned
    (5, "Descatalogado", 3, "kg", 1, 5.0, "kg", 0, 0, None),
    # unpriced and no frozen origin -> stays zero
    (6, "Sin precio", 3, "kg", 1, 0.0, "kg", 0, 1, None),
]


@pytest.fixture
def escandallos_url(tmp_path):
    path = tmp_path / "escandallos.db"
    url = f"sqlite:///{path}"
    engine = sa.create_engine(url)
    with engine.begin() as conn:
        conn.execute(sa.text(DDL))
        conn.execute(
            sa.text(
                "INSERT INTO ingredientes VALUES "
                "(:id,:nombre,:categoria_id,:unidad_compra,:cantidad_compra,"
                ":precio_compra,:unidad_uso,:merma_porcentaje,:activo,:frozen_origen_id)"
            ),
            [
                dict(
                    zip(
                        [
                            "id", "nombre", "categoria_id", "unidad_compra",
                            "cantidad_compra", "precio_compra", "unidad_uso",
                            "merma_porcentaje", "activo", "frozen_origen_id",
                        ],
                        r,
                    )
                )
                for r in ROWS
            ],
        )
    engine.dispose()
    return url


def _ing(**over):
    base = {
        "id": 99,
        "nombre": "Test",
        "unidad_compra": "kg",
        "cantidad_compra": 1.0,
        "precio_compra": 10.0,
        "unidad_uso": "kg",
        "merma_porcentaje": 0.0,
        "frozen_origen_id": None,
    }
    base.update(over)
    return base


# --- conversion -------------------------------------------------------------

def test_convertir_within_a_family():
    assert convertir(1, "kg", "g") == 1000
    assert convertir(1, "litro", "ml") == 1000
    assert convertir(500, "g", "kg") == 0.5


def test_convertir_rejects_incompatible_units():
    with pytest.raises(ValueError):
        convertir(1, "kg", "litro")


# --- cost formula -----------------------------------------------------------

def test_cost_divides_purchase_quantity():
    # 6 litres for 9.00 -> 1.50 per litre
    assert coste_por_unidad_uso(
        _ing(unidad_compra="litro", cantidad_compra=6, precio_compra=9.0, unidad_uso="litro")
    ) == pytest.approx(1.5)


def test_cost_converts_between_units():
    # 1 kg for 2.00, used in grams -> 0.002 per gram
    assert coste_por_unidad_uso(
        _ing(unidad_compra="kg", cantidad_compra=1, precio_compra=2.0, unidad_uso="g")
    ) == pytest.approx(0.002)


def test_cost_inflates_for_merma():
    # 10% waste makes each usable gram cost more
    assert coste_por_unidad_uso(
        _ing(unidad_compra="kg", cantidad_compra=1, precio_compra=2.0, unidad_uso="g",
             merma_porcentaje=10)
    ) == pytest.approx(0.002 / 0.9)


def test_cost_is_zero_for_total_merma_rather_than_raising():
    """Upstream raises; a sync must not die on one bad row."""
    assert coste_por_unidad_uso(_ing(merma_porcentaje=100)) == 0.0


def test_cost_is_zero_for_incompatible_units():
    assert coste_por_unidad_uso(_ing(unidad_compra="kg", unidad_uso="litro")) == 0.0


def test_cost_is_zero_for_zero_quantity():
    assert coste_por_unidad_uso(_ing(cantidad_compra=0)) == 0.0


# --- frozen resolution ------------------------------------------------------

def test_frozen_item_takes_its_cost_from_the_origin_bean():
    origin = _ing(id=2, precio_compra=6.68, unidad_compra="unidad", unidad_uso="unidad")
    frozen = _ing(id=3, precio_compra=0.0, unidad_compra="unidad", unidad_uso="unidad",
                  frozen_origen_id=2)
    assert resolve_cost(frozen, {2: origin}) == pytest.approx(6.68)


def test_frozen_item_with_a_missing_origin_stays_zero():
    frozen = _ing(precio_compra=0.0, frozen_origen_id=404)
    assert resolve_cost(frozen, {}) == 0.0


def test_self_referencing_origin_does_not_recurse():
    row = _ing(id=7, precio_compra=0.0, frozen_origen_id=7)
    assert resolve_cost(row, {7: row}) == 0.0


# --- query path -------------------------------------------------------------

def test_ingredient_costs_against_a_real_table(escandallos_url):
    costs = {c["nombre"]: c["cost"] for c in ingredient_costs(escandallos_url)}

    assert "Descatalogado" not in costs  # inactive filtered out
    assert costs["Leche entera"] == pytest.approx(1.5)
    assert costs["200g DABOV Mexico La Perla"] == pytest.approx(6.68)
    assert costs["Frozen Mexico La Perla Bru1"] == pytest.approx(6.68)
    assert costs["Harina"] == pytest.approx(0.002222, abs=1e-6)
    assert costs["Sin precio"] == 0.0


def test_ingredient_count(escandallos_url):
    assert ingredient_count(escandallos_url) == len(ROWS)


def test_missing_url_raises_not_configured(monkeypatch):
    monkeypatch.delenv("ESCANDALLOS_DATABASE_URL", raising=False)
    with pytest.raises(EscandallosNotConfigured):
        ingredient_costs()
