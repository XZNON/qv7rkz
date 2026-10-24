"""Turn a single-value forecast into a plan, using only errors known at decision time.

For a decision about delivery day D, the training set is the CALIBRATION_DAYS
delivery days ending at D-2 (all of their actuals are published before any
decision time on D-1), each with the forecast selected by the same cutoff rule.
Errors are grouped by forecast level, because error size and bias depend on it.

Band arithmetic: error = forecast - actual, so actual = forecast - error.
The actual's 10th percentile is therefore forecast minus the error's 90th.
"""

from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd

from app.config import CALIBRATION_DAYS, LEVEL_EDGES_MW, LEVEL_LABELS, MIN_BIN_HOURS


@dataclass(frozen=True)
class LevelBin:
    label: str
    low_mw: float
    high_mw: float | None  # None = open-ended
    n_hours: int
    pooled_with: tuple[str, ...]  # labels borrowed from when the bin had too few hours
    q10: float
    q50: float
    q90: float


def training_days(delivery_day: date) -> list[date]:
    """Delivery days whose actuals were fully known before deciding for `delivery_day`."""
    last = delivery_day - timedelta(days=2)
    return [last - timedelta(days=i) for i in range(CALIBRATION_DAYS - 1, -1, -1)]


def level_index(forecast_mw: pd.Series) -> pd.Series:
    """Index into LEVEL_LABELS for each forecast value."""
    return pd.Series(
        np.searchsorted(LEVEL_EDGES_MW, forecast_mw, side="right") - 1, index=forecast_mw.index
    ).clip(lower=0)


def fit_bins(train: pd.DataFrame) -> list[LevelBin]:
    """Error quantiles per forecast-level bin. Needs forecast_mw and error_mw columns."""
    train = train.dropna(subset=["forecast_mw", "error_mw"])
    idx = level_index(train["forecast_mw"])
    last = len(LEVEL_LABELS) - 1
    bins = []
    for i, label in enumerate(LEVEL_LABELS):
        lo, hi = i, i
        rows = train[idx == i]
        while len(rows) < MIN_BIN_HOURS and (lo > 0 or hi < last):
            lo, hi = max(0, lo - 1), min(last, hi + 1)
            rows = train[(idx >= lo) & (idx <= hi)]
        q10, q50, q90 = rows["error_mw"].quantile([0.1, 0.5, 0.9]) if len(rows) else (0, 0, 0)
        bins.append(
            LevelBin(
                label=label,
                low_mw=LEVEL_EDGES_MW[i],
                high_mw=LEVEL_EDGES_MW[i + 1] if i < last else None,
                n_hours=len(rows),
                pooled_with=tuple(LEVEL_LABELS[j] for j in range(lo, hi + 1) if j != i),
                q10=float(q10),
                q50=float(q50),
                q90=float(q90),
            )
        )
    return bins


def apply_bins(selected: pd.DataFrame, bins: list[LevelBin]) -> pd.DataFrame:
    """Add level_bin, adjusted_mw (median-error corrected) and the 80% band for the actual."""
    out = selected.copy()
    idx = level_index(out["forecast_mw"].fillna(0))
    q10 = idx.map(lambda i: bins[i].q10)
    q50 = idx.map(lambda i: bins[i].q50)
    q90 = idx.map(lambda i: bins[i].q90)
    out["level_bin"] = idx.map(lambda i: bins[i].label).where(out["forecast_mw"].notna())
    out["adjusted_mw"] = (out["forecast_mw"] - q50).clip(lower=0)
    out["band_low_mw"] = (out["forecast_mw"] - q90).clip(lower=0)
    out["band_high_mw"] = (out["forecast_mw"] - q10).clip(lower=0)
    return out
