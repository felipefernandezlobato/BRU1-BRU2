from app.models import Setting
from app.services.fixed_costs import (
    FIXED_COSTS,
    fixed_costs_for_month,
    get_fixed_costs,
    get_monthly_rent,
    load_settings,
    month_open_factor,
    setting_keys,
)


def _seed_fixed_costs(db):
    """Write the default amount/active/estimado rows, as the prod script does."""
    for slug, _label, amount, estimado in FIXED_COSTS:
        amount_key, active_key, estimado_key = setting_keys(slug)
        db.add(Setting(key=amount_key, value=f"{amount:.2f}"))
        db.add(Setting(key=active_key, value="true"))
        db.add(Setting(key=estimado_key, value="true" if estimado else "false"))
    db.commit()


def test_month_open_factor_before_opening():
    assert month_open_factor(2026, 1) == 0.0
    assert month_open_factor(2025, 12) == 0.0


def test_month_open_factor_opening_month_is_half():
    # BRU2 opened 2026-02-16, so February carries half a month.
    assert month_open_factor(2026, 2) == 0.5


def test_month_open_factor_after_opening():
    assert month_open_factor(2026, 3) == 1.0
    assert month_open_factor(2027, 1) == 1.0


def test_defaults_apply_when_settings_missing():
    """An unseeded DB should report the defined defaults, not zero."""
    costs = {c["slug"]: c for c in get_fixed_costs({})}
    assert costs["utilities"]["amount"] == 850.0
    assert costs["sunrise"]["amount"] == 50.0
    assert costs["lightspeed"]["amount"] == 140.0
    assert costs["transporte_sergio"]["amount"] == 700.0
    assert all(c["active"] for c in costs.values())


def test_estimado_flags_match_the_unconfirmed_costs():
    costs = {c["slug"]: c for c in get_fixed_costs({})}
    assert costs["sunrise"]["estimado"] is True
    assert costs["transporte_sergio"]["estimado"] is True
    assert costs["utilities"]["estimado"] is False
    assert costs["lightspeed"]["estimado"] is False


def test_stored_values_override_defaults():
    settings = {"cost_sunrise_amount": "25.00", "cost_sunrise_estimado": "false"}
    sunrise = next(c for c in get_fixed_costs(settings) if c["slug"] == "sunrise")
    assert sunrise["amount"] == 25.0
    assert sunrise["estimado"] is False


def test_malformed_amount_falls_back_to_default():
    sunrise = next(
        c for c in get_fixed_costs({"cost_sunrise_amount": "n/a"}) if c["slug"] == "sunrise"
    )
    assert sunrise["amount"] == 50.0


def test_total_for_a_full_month(db):
    _seed_fixed_costs(db)

    result = fixed_costs_for_month(load_settings(db), 2026, 9)
    assert result["total"] == 1740.00
    assert len(result["items"]) == 4


def test_opening_month_is_prorated_to_half(db):
    _seed_fixed_costs(db)

    result = fixed_costs_for_month(load_settings(db), 2026, 2)
    assert result["total"] == 870.00


def test_months_before_opening_are_zero(db):
    _seed_fixed_costs(db)

    result = fixed_costs_for_month(load_settings(db), 2026, 1)
    assert result["total"] == 0.0


def test_inactive_costs_are_excluded():
    settings = {"cost_transporte_sergio_active": "false"}
    result = fixed_costs_for_month(settings, 2026, 9)
    assert result["total"] == 1040.00  # 1740 - 700
    assert "transporte_sergio" not in [i["slug"] for i in result["items"]]


def test_monthly_rent_defaults_to_zero_when_unset():
    assert get_monthly_rent({}) == 0.0
    assert get_monthly_rent({"monthly_rent": "5945.50"}) == 5945.50


def test_monthly_combined_includes_fixed_costs(admin_client, db):
    _seed_fixed_costs(db)
    db.add(Setting(key="monthly_rent", value="5945.50"))
    db.commit()

    resp = admin_client.get("/api/analytics/monthly-combined?months=12")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 12

    for row in data:
        assert "fixed_costs" in row
        assert "fixed_cost_items" in row
        factor = month_open_factor(row["year"], row["month"])
        assert row["fixed_costs"] == round(1740.00 * factor, 2)
        # Rent must use the same proration as the other fixed costs.
        assert row["rent"] == round(5945.50 * factor, 2)


def test_monthly_combined_itemises_each_cost_separately(admin_client, db):
    _seed_fixed_costs(db)
    resp = admin_client.get("/api/analytics/monthly-combined?months=1")
    assert resp.status_code == 200
    items = resp.json()[0]["fixed_cost_items"]
    assert [i["label"] for i in items] == [
        "Utilities",
        "Sunrise",
        "Lightspeed",
        "Transporte Sergio",
    ]
    assert {i["slug"]: i["estimado"] for i in items} == {
        "utilities": False,
        "sunrise": True,
        "lightspeed": False,
        "transporte_sergio": True,
    }


def test_monthly_combined_requires_admin(client):
    assert client.get("/api/analytics/monthly-combined").status_code in (401, 403)
