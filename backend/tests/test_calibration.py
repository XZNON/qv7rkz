from datetime import date, time

import pandas as pd
import pytest

from app import analysis
from app.calibration import LevelBin, apply_bins, fit_bins, training_days
from app.data import load_actuals


def test_training_window_is_30_settled_days_ending_two_days_before_delivery() -> None:
    days = training_days(date(2026, 1, 20))

    assert len(days) == 30
    assert days[0] == date(2025, 12, 20)
    assert days[-1] == date(2026, 1, 18)


def test_bins_use_error_quantiles_of_hours_at_that_forecast_level() -> None:
    train = pd.DataFrame(
        {"forecast_mw": [7_000.0] * 101, "error_mw": [float(e) for e in range(-50, 51)]}
    )
    mid = fit_bins(train)[1]

    assert mid.label == "5-10 GW"
    assert mid.n_hours == 101
    assert mid.pooled_with == ()
    assert (mid.q10, mid.q50, mid.q90) == (-40, 0, 40)


def test_small_bin_borrows_hours_from_its_neighbour() -> None:
    train = pd.DataFrame(
        {
            "forecast_mw": [12_000.0] * 40 + [16_000.0] * 5,
            "error_mw": [100.0] * 40 + [3_000.0] * 5,
        }
    )
    top = fit_bins(train)[3]

    assert top.n_hours == 45
    assert top.pooled_with == ("10-15 GW",)


def flat_bins(q10: float, q50: float, q90: float) -> list[LevelBin]:
    return [LevelBin(str(i), 0, None, 100, (), q10, q50, q90) for i in range(4)]


def test_band_inverts_error_quantiles_into_a_range_for_the_actual() -> None:
    selected = pd.DataFrame({"forecast_mw": [10_000.0]})
    out = apply_bins(selected, flat_bins(q10=-1_000, q50=500, q90=3_000)).iloc[0]

    assert out["adjusted_mw"] == 9_500
    assert out["band_low_mw"] == 7_000  # forecast - error P90
    assert out["band_high_mw"] == 11_000  # forecast - error P10


def test_band_and_adjusted_line_never_go_below_zero() -> None:
    selected = pd.DataFrame({"forecast_mw": [1_000.0]})
    out = apply_bins(selected, flat_bins(q10=0, q50=2_000, q90=3_000)).iloc[0]

    assert out["adjusted_mw"] == 0
    assert out["band_low_mw"] == 0


def bins_with_actuals_zeroed_from(start: str, monkeypatch: pytest.MonkeyPatch) -> list[LevelBin]:
    actuals = load_actuals().copy()
    actuals.loc[actuals["start_time"] >= pd.Timestamp(start), "generation_mw"] = 0
    monkeypatch.setattr(analysis, "load_actuals", lambda: actuals)
    return analysis.evaluate.__wrapped__(time(9, 20)).bins_by_day[date(2026, 1, 20)]


def test_calibration_never_sees_actuals_from_the_decision_day_onwards(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    baseline = analysis.evaluate.__wrapped__(time(9, 20)).bins_by_day[date(2026, 1, 20)]

    # Deciding on 19 Jan for 20 Jan: actuals from 19 Jan onwards were not yet known.
    assert bins_with_actuals_zeroed_from("2026-01-19T00:00Z", monkeypatch) == baseline
    # Sanity check that the test is sensitive: 18 Jan actuals were known and do matter.
    assert bins_with_actuals_zeroed_from("2026-01-18T00:00Z", monkeypatch) != baseline
