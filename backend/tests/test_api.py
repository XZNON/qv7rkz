from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_meta_describes_scope_and_data() -> None:
    body = client.get("/api/meta").json()

    assert body["first_delivery_day"] == "2026-01-02"
    assert body["last_delivery_day"] == "2026-02-01"
    assert body["default_cutoff"] == "09:20"
    assert {d["name"] for d in body["datasets"]} == {"WINDFOR", "FUELHH"}


def test_day_view_uses_default_cutoff() -> None:
    response = client.get("/api/day", params={"date": "2026-01-28"})
    body = response.json()

    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=3600"
    assert body["cutoff"] == "09:20"
    assert body["decision_time"] == "2026-01-27T09:20:00Z"
    assert body["run_publish_time"] == "2026-01-27T07:30:00Z"
    assert len(body["hours"]) == 24
    assert len(body["half_hours"]) == 48
    assert body["hours"][17]["local_time"] == "17:00"
    assert body["hours"][17]["settlement_period"] == 35


def test_day_view_with_custom_cutoff() -> None:
    body = client.get("/api/day", params={"date": "2026-01-28", "cutoff": "15:30"}).json()

    # Strictly before 15:30, so the 11:30 run.
    assert body["run_publish_time"] == "2026-01-27T11:30:00Z"


def test_day_outside_scope_is_rejected() -> None:
    response = client.get("/api/day", params={"date": "2026-02-05"})

    assert response.status_code == 422
    assert "2026-01-02" in response.json()["detail"]


def test_malformed_cutoff_is_rejected() -> None:
    response = client.get("/api/day", params={"date": "2026-01-28", "cutoff": "9:20"})

    assert response.status_code == 422


def test_scorecard_and_signals() -> None:
    scorecard = client.get("/api/scorecard").json()
    signals = client.get("/api/signals", params={"cutoff": "09:50"}).json()

    assert scorecard["summary"]["hours"] == 744
    assert len(scorecard["daily"]) == 31
    assert len(scorecard["heatmap"]) == 744
    assert [g["group"] for g in scorecard["by_lead"]][0] == "12-18 h"
    assert signals["cutoff"] == "09:50"
    assert [s["key"] for s in signals["signals"]] == [
        "high_wind",
        "steep_ramp",
        "big_revision",
        "low_wind_peak",
    ]
