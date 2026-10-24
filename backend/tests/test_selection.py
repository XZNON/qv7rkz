from datetime import date, time

import pandas as pd

from app.data import load_forecasts
from app.selection import cutoff_utc, delivery_hours, select_forecast, select_forecasts
from tests.factories import make_runs

DAY = date(2026, 1, 20)


def test_cutoff_is_local_time_on_previous_day() -> None:
    assert cutoff_utc(DAY, time(9, 20)) == pd.Timestamp("2026-01-19T09:20Z")
    # British Summer Time: 09:20 local is 08:20 UTC.
    assert cutoff_utc(date(2025, 7, 2), time(9, 20)) == pd.Timestamp("2025-07-01T08:20Z")


def test_delivery_day_hours_follow_uk_clock_changes() -> None:
    assert len(delivery_hours(DAY)) == 24
    assert delivery_hours(DAY)[0] == pd.Timestamp("2026-01-20T00:00Z")
    assert len(delivery_hours(date(2026, 3, 29))) == 23
    assert len(delivery_hours(date(2025, 10, 26))) == 25


def test_uses_latest_run_published_before_cutoff_with_previous_run() -> None:
    runs = {"2026-01-19T04:30Z": 9000, "2026-01-19T07:30Z": 10000, "2026-01-19T09:30Z": 12000}
    out = select_forecast(make_runs(runs, "2026-01-20T00:00Z", 24), DAY, time(9, 20))

    assert len(out) == 24
    assert (out["forecast_mw"] == 10000).all()
    assert (out["publish_time"] == pd.Timestamp("2026-01-19T07:30Z")).all()
    assert (out["prev_forecast_mw"] == 9000).all()
    assert (out["revision_mw"] == 1000).all()


def test_run_published_exactly_at_cutoff_is_excluded() -> None:
    runs = {"2026-01-19T11:30Z": 8000, "2026-01-19T15:30Z": 11000}
    out = select_forecast(make_runs(runs, "2026-01-20T00:00Z", 24), DAY, time(15, 30))

    assert (out["publish_time"] == pd.Timestamp("2026-01-19T11:30Z")).all()


def test_hours_without_a_qualifying_run_are_kept_as_nulls() -> None:
    # The only run before the cutoff covers 21 of the 24 delivery hours.
    runs = {"2026-01-18T22:30Z": 7000}
    out = select_forecast(make_runs(runs, "2026-01-20T00:00Z", 21), DAY, time(9, 20))

    assert len(out) == 24
    assert out["forecast_mw"].isna().sum() == 3
    assert out["prev_forecast_mw"].isna().all()


def test_lead_time_is_measured_from_the_decision() -> None:
    runs = {"2026-01-19T07:30Z": 10000}
    out = select_forecast(make_runs(runs, "2026-01-20T00:00Z", 24), DAY, time(9, 20))

    assert out["lead_h"].iloc[0] == 14 + 40 / 60
    assert out["lead_h"].iloc[-1] == 37 + 40 / 60


def test_multi_day_selection_applies_each_days_own_cutoff() -> None:
    runs = {"2026-01-19T07:30Z": 10000, "2026-01-20T07:30Z": 13000}
    forecasts = make_runs(runs, "2026-01-20T00:00Z", 48)
    out = select_forecasts(forecasts, [DAY, date(2026, 1, 21)], time(9, 20))

    by_day = out.groupby("delivery_day")["forecast_mw"].unique()
    assert list(by_day[DAY]) == [10000]
    assert list(by_day[date(2026, 1, 21)]) == [13000]


# Real data: 15 Jan 2026 has no 11:30 run and an off-schedule 12:25 run instead.
def test_real_data_irregular_schedule_on_15_january() -> None:
    forecasts = load_forecasts()
    delivery = date(2026, 1, 16)

    before = select_forecast(forecasts, delivery, time(12, 0))
    after = select_forecast(forecasts, delivery, time(12, 30))

    assert (before["publish_time"] == pd.Timestamp("2026-01-15T09:30Z")).all()
    assert (after["publish_time"] == pd.Timestamp("2026-01-15T12:25Z")).all()


def test_real_data_default_cutoff_uses_0730_run_for_every_hour() -> None:
    out = select_forecast(load_forecasts(), date(2026, 1, 2), time(9, 20))

    assert len(out) == 24
    assert out["forecast_mw"].notna().all()
    assert (out["publish_time"] == pd.Timestamp("2026-01-01T07:30Z")).all()
