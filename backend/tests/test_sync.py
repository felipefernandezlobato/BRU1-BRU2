import httpx
import pytest

from app.models import Setting

ESCANDALLOS_URL = "https://escandallos.example.com"


class _FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=None, response=None)

    def json(self):
        return self._payload


@pytest.fixture
def escandallos_url(db):
    db.add(Setting(key="escandallos_api_url", value=ESCANDALLOS_URL))
    db.commit()


def test_connection_test_hits_the_public_health_endpoint(
    admin_client, escandallos_url, monkeypatch
):
    """Only /api/health is unauthenticated upstream, so that is what we probe."""
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return _FakeResponse({"status": "ok"})

    monkeypatch.setattr(httpx, "get", fake_get)

    resp = admin_client.post("/api/sync/test")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "url": ESCANDALLOS_URL}
    assert calls == [f"{ESCANDALLOS_URL}/api/health"]


def test_connection_test_tolerates_a_trailing_slash_in_the_url(
    admin_client, db, monkeypatch
):
    db.add(Setting(key="escandallos_api_url", value=f"{ESCANDALLOS_URL}/"))
    db.commit()
    calls = []
    monkeypatch.setattr(
        httpx, "get", lambda url, **kw: (calls.append(url), _FakeResponse({"status": "ok"}))[1]
    )

    resp = admin_client.post("/api/sync/test")
    assert resp.status_code == 200
    assert calls == [f"{ESCANDALLOS_URL}/api/health"]


def test_connection_test_requires_the_url_setting(admin_client, db):
    resp = admin_client.post("/api/sync/test")
    assert resp.status_code == 400
    assert "escandallos_api_url" in resp.json()["detail"]


def test_connection_test_reports_an_unreachable_api(
    admin_client, escandallos_url, monkeypatch
):
    def fake_get(url, **kwargs):
        raise httpx.ConnectError("no route to host")

    monkeypatch.setattr(httpx, "get", fake_get)

    resp = admin_client.post("/api/sync/test")
    assert resp.status_code == 502


def test_connection_test_requires_admin(client):
    assert client.post("/api/sync/test").status_code in (401, 403)


def test_sync_still_matches_items_by_escandallos_name(
    admin_client, escandallos_url, item_coffee, db, monkeypatch
):
    """The refactor that extracted _fetch_ingredients must not change syncing."""
    item_coffee.escandallos_name = "Cafe Escandallos"
    db.commit()

    def fake_get(url, **kwargs):
        return _FakeResponse([{"name": "Cafe Escandallos", "cost": 99.5}])

    monkeypatch.setattr(httpx, "get", fake_get)

    resp = admin_client.post("/api/sync/escandallos")
    assert resp.status_code == 200
    matches = resp.json()
    assert len(matches) == 1
    assert matches[0]["escandallos_name"] == "Cafe Escandallos"
    assert matches[0]["new_cost"] == 99.5
