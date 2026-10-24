import math
from datetime import time

import pandas as pd

from app.analysis import evaluate
from app.metrics import hourly_actuals, lead_bucket, summarize, with_errors


def half_hours(values: dict[str, float]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "start_time": pd.to_datetime(list(values), utc=True),
            "generation_mw": list(values.values()),
        }
    )


def test_hourly_actual_is_mean_of_two_half_hours() -> None:
    hourly = hourly_actuals(half_hours({"2026-01-20T10:00Z": 9000, "2026-01-20T10:30Z": 10000}))

    assert hourly[pd.Timestamp("2026-01-20T10:00Z")] == 9500


def test_hour_missing_a_half_is_null() -> None:
    hourly = hourly_actuals(
        half_hours(
            {"2026-01-20T10:00Z": 9000, "2026-01-20T10:30Z": 10000, "2026-01-20T11:00Z": 8000}
        )
    )

    assert math.isnan(hourly[pd.Timestamp("2026-01-20T11:00Z")])


def test_error_is_forecast_minus_actual() -> None:
    selected = pd.DataFrame(
        {"start_time": pd.to_datetime(["2026-01-20T10:00Z"], utc=True), "forecast_mw": [12000.0]}
    )
    hourly = pd.Series({pd.Timestamp("2026-01-20T10:00Z"): 9500.0})

    out = with_errors(selected, hourly)

    assert out["actual_mw"].iloc[0] == 9500
    assert out["error_mw"].iloc[0] == 2500  # positive = over-forecast


def evaluated_hours() -> pd.DataFrame:
    forecast = [11_000.0, 9_000.0, 12_000.0, 10_000.0]
    actual = [10_000.0, 10_000.0, 10_000.0, 10_000.0]
    return pd.DataFrame(
        {
            "start_time": pd.date_range("2026-01-20T00:00Z", periods=4, freq="h"),
            "publish_time": pd.Timestamp("2026-01-19T07:30Z"),
            "forecast_mw": forecast,
            "actual_mw": actual,
            "error_mw": [f - a for f, a in zip(forecast, actual, strict=True)],
            "adjusted_mw": [10_500.0, 9_500.0, 11_000.0, 10_000.0],
            "band_low_mw": [9_000.0, 8_000.0, 10_500.0, 9_000.0],
            "band_high_mw": [12_000.0, 11_000.0, 13_000.0, 11_000.0],
        }
    )


def test_summary_matches_hand_computed_values() -> None:
    s = summarize(evaluated_hours())

    assert s["hours"] == 4
    assert s["mae_mw"] == 1_000  # (1000 + 1000 + 2000 + 0) / 4
    assert s["bias_mw"] == 500  # (1000 - 1000 + 2000 + 0) / 4
    assert s["wape_pct"] == 10
    assert s["within_1gw_pct"] == 75
    assert s["over_forecast_hours_pct"] == 50
    assert s["adjusted_mae_mw"] == 500
    assert s["adjusted_improvement_pct"] == 50
    assert s["band_coverage_pct"] == 75  # third hour's actual is below its band


def test_hours_without_actuals_or_published_late_are_not_scored() -> None:
    df = evaluated_hours()
    df.loc[0, "actual_mw"] = float("nan")
    df.loc[1, "publish_time"] = df.loc[1, "start_time"]

    assert summarize(df)["hours"] == 2


def test_lead_bucket_labels() -> None:
    labels = lead_bucket(pd.Series([14.67, 18.0, 37.9])).tolist()

    assert labels == ["12-18 h", "18-24 h", "36-42 h"]


# Regression guard on the real January data at the default decision time.
def test_real_data_default_cutoff_accuracy() -> None:
    s = summarize(evaluate(time(9, 20)).hours)

    assert s["hours"] == 744
    assert round(s["mae_mw"]) == 2039
    assert round(s["bias_mw"]) == 1748
