import pytest


def test_create_personnel_cost(admin_client):
    resp = admin_client.post("/api/personnel/", json={
        "year": 2026,
        "month": 3,
        "total_paid": 10000.0,
        "bru1_e2n": 7000.0,
        "bru2_e2n": 3000.0,
        "notes": "Test record",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["year"] == 2026
    assert data["month"] == 3
    assert data["total_paid"] == 10000.0
    # ratio = 3000 / (7000 + 3000) = 0.3
    assert abs(data["ratio"] - 0.3) < 1e-4
    # bru2_cost = 10000 * 0.3 = 3000
    assert abs(data["bru2_cost"] - 3000.0) < 0.01
    assert data["notes"] == "Test record"


def test_create_personnel_cost_real_data(admin_client):
    """Test with real February 2026 data."""
    resp = admin_client.post("/api/personnel/", json={
        "year": 2026,
        "month": 2,
        "total_paid": 35370.0,
        "bru1_e2n": 32515.90,
        "bru2_e2n": 7344.42,
    })
    assert resp.status_code == 201
    data = resp.json()
    # ratio = 7344.42 / (32515.90 + 7344.42) = 7344.42 / 39860.32 ≈ 0.1843
    assert abs(data["ratio"] - 0.1843) < 0.001
    # bru2_cost = 35370.0 * 0.1843 ≈ 6517.06
    assert abs(data["bru2_cost"] - 6517.06) < 5.0


def test_list_personnel_costs_ordered(admin_client):
    # Create records for different months
    admin_client.post("/api/personnel/", json={
        "year": 2026, "month": 2,
        "total_paid": 10000, "bru1_e2n": 7000, "bru2_e2n": 3000,
    })
    admin_client.post("/api/personnel/", json={
        "year": 2026, "month": 5,
        "total_paid": 12000, "bru1_e2n": 8000, "bru2_e2n": 4000,
    })
    admin_client.post("/api/personnel/", json={
        "year": 2025, "month": 12,
        "total_paid": 9000, "bru1_e2n": 6000, "bru2_e2n": 3000,
    })

    resp = admin_client.get("/api/personnel/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    # Ordered by year desc, month desc
    assert data[0]["year"] == 2026 and data[0]["month"] == 5
    assert data[1]["year"] == 2026 and data[1]["month"] == 2
    assert data[2]["year"] == 2025 and data[2]["month"] == 12


def test_get_specific_month(admin_client):
    admin_client.post("/api/personnel/", json={
        "year": 2026, "month": 4,
        "total_paid": 44591.0, "bru1_e2n": 33917.87, "bru2_e2n": 13901.41,
    })

    resp = admin_client.get("/api/personnel/2026/4")
    assert resp.status_code == 200
    data = resp.json()
    assert data["year"] == 2026
    assert data["month"] == 4
    assert data["total_paid"] == 44591.0


def test_get_nonexistent_month(admin_client):
    resp = admin_client.get("/api/personnel/2026/11")
    assert resp.status_code == 404


def test_upsert_updates_existing(admin_client):
    # Create initial record
    resp1 = admin_client.post("/api/personnel/", json={
        "year": 2026, "month": 6,
        "total_paid": 40000.0, "bru1_e2n": 30000.0, "bru2_e2n": 10000.0,
    })
    assert resp1.status_code == 201
    original_id = resp1.json()["id"]

    # Upsert with new values for the same year/month
    resp2 = admin_client.post("/api/personnel/", json={
        "year": 2026, "month": 6,
        "total_paid": 45056.0, "bru1_e2n": 44757.0, "bru2_e2n": 13731.0,
        "notes": "Updated",
    })
    assert resp2.status_code == 201
    data = resp2.json()
    assert data["id"] == original_id  # Same record updated
    assert data["total_paid"] == 45056.0
    assert data["notes"] == "Updated"

    # Verify only one record exists
    resp3 = admin_client.get("/api/personnel/")
    assert len(resp3.json()) == 1


def test_delete_personnel_cost(admin_client):
    admin_client.post("/api/personnel/", json={
        "year": 2026, "month": 7,
        "total_paid": 10000, "bru1_e2n": 7000, "bru2_e2n": 3000,
    })

    resp = admin_client.delete("/api/personnel/2026/7")
    assert resp.status_code == 200

    # Verify it's gone
    resp2 = admin_client.get("/api/personnel/2026/7")
    assert resp2.status_code == 404


def test_delete_nonexistent(admin_client):
    resp = admin_client.delete("/api/personnel/2026/11")
    assert resp.status_code == 404


def test_staff_forbidden(staff_client):
    resp = staff_client.get("/api/personnel/")
    assert resp.status_code == 403

    resp = staff_client.post("/api/personnel/", json={
        "year": 2026, "month": 1,
        "total_paid": 10000, "bru1_e2n": 7000, "bru2_e2n": 3000,
    })
    assert resp.status_code == 403

    resp = staff_client.get("/api/personnel/2026/1")
    assert resp.status_code == 403

    resp = staff_client.delete("/api/personnel/2026/1")
    assert resp.status_code == 403
