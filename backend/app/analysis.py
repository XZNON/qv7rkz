"""Evaluate every in-scope delivery hour for one decision time.

Ties together selection, alignment, rolling calibration and signals. Results
are cached per cutoff: the data are static, so each cutoff is computed once.
"""

from dataclasses import dataclass
from datetime import date, time, timedelta
from functools import lru_cache

import pandas as pd

from app.calibration import LevelBin, apply_bins, fit_bins, training_days
from app.config import CALIBRATION_DAYS, FIRST_DELIVERY_DAY, LAST_DELIVERY_DAY
from app.data import load_actuals, load_forecasts
from app.metrics import hourly_actuals, with_errors
from app.selection import select_forecasts
from app.signals import flag_signals


@dataclass(frozen=True)
class Evaluation:
    hours: pd.DataFrame  # one row per in-scope delivery hour, fully annotated
    bins_by_day: dict[date, list[LevelBin]]


def day_range(first: date, last: date) -> list[date]:
    return [first + timedelta(days=i) for i in range((last - first).days + 1)]


def delivery_days() -> list[date]:
    return day_range(FIRST_DELIVERY_DAY, LAST_DELIVERY_DAY)


@lru_cache(maxsize=32)
def evaluate(cutoff: time) -> Evaluation:
    history_start = FIRST_DELIVERY_DAY - timedelta(days=CALIBRATION_DAYS + 1)
    selected = select_forecasts(
        load_forecasts(), day_range(history_start, LAST_DELIVERY_DAY), cutoff
    )
    selected = with_errors(selected, hourly_actuals(load_actuals()))

    frames, bins_by_day = [], {}
    for day in delivery_days():
        bins = fit_bins(selected[selected["delivery_day"].isin(training_days(day))])
        bins_by_day[day] = bins
        frames.append(apply_bins(selected[selected["delivery_day"] == day], bins))

    hours = flag_signals(pd.concat(frames, ignore_index=True))
    return Evaluation(hours=hours, bins_by_day=bins_by_day)
