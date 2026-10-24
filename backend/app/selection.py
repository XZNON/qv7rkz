"""As-of forecast selection: what the trader could actually see at the decision time.

Rule: for each delivery hour, use the forecast row with the latest publish_time
strictly before the cutoff (local time on D-1). The publish schedule is irregular,
so it is never hard-coded; selection works purely on publish_time.
"""

from collections.abc import Iterable
from datetime import date, datetime, time, timedelta

import pandas as pd

from app.config import LONDON


def cutoff_utc(delivery_day: date, cutoff: time) -> pd.Timestamp:
    """Decision moment: `cutoff` UK local time on the day before delivery, in UTC."""
    local = datetime.combine(delivery_day - timedelta(days=1), cutoff, tzinfo=LONDON)
    return pd.Timestamp(local).tz_convert("UTC")


def delivery_hours(delivery_day: date) -> pd.DatetimeIndex:
    """Hourly start times (UTC) covering the UK local delivery day: 23, 24 or 25 hours."""
    start = pd.Timestamp(datetime.combine(delivery_day, time(0), tzinfo=LONDON))
    end = pd.Timestamp(datetime.combine(delivery_day + timedelta(days=1), time(0), tzinfo=LONDON))
    return pd.date_range(start.tz_convert("UTC"), end.tz_convert("UTC"), freq="h", inclusive="left")


def select_forecasts(
    forecasts: pd.DataFrame, delivery_days: Iterable[date], cutoff: time
) -> pd.DataFrame:
    """Forecast available at the decision time for every hour of the given delivery days.

    Returns one row per delivery hour (hours with no qualifying run are kept, with
    nulls), with columns: start_time, delivery_day, cutoff_time, forecast_mw,
    publish_time, prev_forecast_mw, prev_publish_time, revision_mw, lead_h.
    """
    days = sorted(set(delivery_days))
    frames = [
        pd.DataFrame(
            {
                "start_time": delivery_hours(day),
                "delivery_day": day,
                "cutoff_time": cutoff_utc(day, cutoff),
            }
        )
        for day in days
    ]
    grid = pd.concat(frames, ignore_index=True)

    candidates = forecasts.merge(grid[["start_time", "cutoff_time"]], on="start_time")
    candidates = candidates[candidates["publish_time"] < candidates["cutoff_time"]]
    candidates = candidates.sort_values(["start_time", "publish_time"], ascending=[True, False])
    rank = candidates.groupby("start_time").cumcount()

    latest = candidates[rank == 0].set_index("start_time")
    previous = candidates[rank == 1].set_index("start_time")

    out = grid.set_index("start_time")
    out["forecast_mw"] = latest["generation_mw"].astype("float64")
    out["publish_time"] = latest["publish_time"]
    out["prev_forecast_mw"] = previous["generation_mw"].astype("float64")
    out["prev_publish_time"] = previous["publish_time"]
    out["revision_mw"] = out["forecast_mw"] - out["prev_forecast_mw"]
    out["lead_h"] = (out.index - out["cutoff_time"]) / pd.Timedelta(hours=1)
    return out.reset_index()


def select_forecast(forecasts: pd.DataFrame, delivery_day: date, cutoff: time) -> pd.DataFrame:
    """Single-day convenience wrapper around select_forecasts."""
    return select_forecasts(forecasts, [delivery_day], cutoff)
