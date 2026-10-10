import pytest

from app.models import CostHistory, Item
from app.services.escandallos import EscandallosNotConfigured


@pytest.fixture
def linked_item(db, item_coffee):
    """An item wired to an Escandallos ingredient by name."""
    item_coffee.escandallos_name = "1kg DABOV Ethiopia Yirgacheffe"
    db.commit()
    db.refresh(item_coffee)
    return item_coffee


def _stub_costs(monkeypatch, costs):
    monkeypatch.setattr(
        "app.routers.sync.ingredient_costs",
        lambda *a: [{"nombre": n, "cost": c} for n, c in costs.items()],
    )


# --- connection test --------------------------------------------------------

def test_test_endpoint_reports_the_row_count(admin_client, monkeypatch):
    monkeypatch.setattr("app.routers.sync.ingredient_count", lambda *a: 412)
    resp = admin_client.post("/api/sync/test")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "ingredients": 412}


def test_test_endpoint_400_when_not_configured(admin_client, monkeypatch):
    def boom(*a):
        raise EscandallosNotConfigured()

    monkeypatch.setattr("app.routers.sync.ingredient_count", boom)
    resp = admin_client.post("/api/sync/test")
    assert resp.status_code == 400
    assert "ESCANDALLOS_DATABASE_URL" in resp.json()["detail"]


def test_test_endpoint_502_when_unreachable(admin_client, monkeypatch):
    def boom(*a):
        raise OSError("connection refused")

    monkeypatch.setattr("app.routers.sync.ingredient_count", boom)
    assert admin_client.post("/api/sync/test").status_code == 502


def test_test_endpoint_requires_admin(client):
    assert client.post("/api/sync/test").status_code in (401, 403)


# --- preview ----------------------------------------------------------------

def test_preview_matches_by_escandallos_name(admin_client, linked_item, monkeypatch):
    _stub_costs(monkeypatch, {"1kg DABOV Ethiopia Yirgacheffe": 21.75})

    resp = admin_client.post("/api/sync/escandallos")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["matches"]) == 1
    match = body["matches"][0]
    assert match["item_id"] == linked_item.id
    assert match["name"] == linked_item.name
    assert match["current_cost"] == 18.50
    assert match["new_cost"] == 21.75


def test_preview_refuses_to_zero_out_a_cost(admin_client, linked_item, monkeypatch):
    """A frozen item with no origin prices at 0 upstream; it must not be applied."""
    _stub_costs(monkeypatch, {"1kg DABOV Ethiopia Yirgacheffe": 0.0})

    body = admin_client.post("/api/sync/escandallos").json()
    assert body["matches"] == []
    assert len(body["skipped"]) == 1
    assert body["skipped"][0]["reason"] == "coste cero en Escandallos"


def test_preview_reports_items_absent_upstream(admin_client, linked_item, monkeypatch):
    _stub_costs(monkeypatch, {"Otra cosa": 5.0})

    body = admin_client.post("/api/sync/escandallos").json()
    assert body["matches"] == []
    assert body["skipped"][0]["reason"] == "no encontrado en Escandallos"


def test_preview_omits_unchanged_costs(admin_client, linked_item, monkeypatch):
    _stub_costs(monkeypatch, {"1kg DABOV Ethiopia Yirgacheffe": 18.50})

    body = admin_client.post("/api/sync/escandallos").json()
    assert body["matches"] == []
    assert body["skipped"] == []


def test_preview_ignores_unlinked_items(admin_client, item_coffee, monkeypatch):
    """item_coffee has no escandallos_name here, so it is not considered."""
    _stub_costs(monkeypatch, {"Anything": 1.0})

    body = admin_client.post("/api/sync/escandallos").json()
    assert body["matches"] == []
    assert body["skipped"] == []


def test_preview_requires_admin(client):
    assert client.post("/api/sync/escandallos").status_code in (401, 403)


# --- confirm ----------------------------------------------------------------

def test_confirm_applies_cost_and_records_history(admin_client, linked_item, db):
    resp = admin_client.post(
        "/api/sync/confirm",
        json=[{"item_id": linked_item.id, "new_cost": 21.75}],
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] == 1

    db.expire_all()
    assert db.query(Item).get(linked_item.id).cost_per_unit == 21.75
    history = db.query(CostHistory).filter(CostHistory.item_id == linked_item.id).one()
    assert history.old_cost == 18.50
    assert history.new_cost == 21.75
    assert history.change_source == "sync"


def test_confirm_rejects_a_zero_cost(admin_client, linked_item, db):
    resp = admin_client.post(
        "/api/sync/confirm",
        json=[{"item_id": linked_item.id, "new_cost": 0.0}],
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] == 0

    db.expire_all()
    assert db.query(Item).get(linked_item.id).cost_per_unit == 18.50


def test_confirm_skips_unknown_items(admin_client, db):
    resp = admin_client.post(
        "/api/sync/confirm", json=[{"item_id": 99999, "new_cost": 5.0}]
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] == 0
