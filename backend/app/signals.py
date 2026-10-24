"""Warning signals visible at the decision time, and a back-test of each one.

Each signal is computed only from the forecast and its revision, so it was
available when the trader decided. The back-test compares errors in flagged
and unflagged hours; a signal is only called "backed by the data" if the
difference is large enough on enough hours.
"""

from dataclasses import dataclass

import pandas as pd

from app.config import (
    BIG_REVISION_MW,
    HIGH_WIND_MW,
    LONDON,
    LOW_WIND_MW,
    PEAK_HOURS,
    RAMP_HOURS,
    RAMP_MW,
    SIGNAL_MIN_FLAGGED_HOURS,
    SIGNAL_MIN_MAE_RATIO,
)


@dataclass(frozen=True)
class Signal:
    key: str
    title: str
    rule: str
    meaning: str
    kind: str  # "error" signals predict forecast error; "price" signals flag market risk


SIGNALS = (
    Signal(
        "high_wind",
        "High wind forecast",
        f"Forecast at or above {HIGH_WIND_MW / 1000:.0f} GW",
        "Metered wind has come in well below forecasts this high (likely curtailment).",
        "error",
    ),
    Signal(
        "steep_ramp",
        "Steep ramp",
        f"Forecast changes by {RAMP_MW / 1000:.0f} GW or more within {RAMP_HOURS} hours",
        "Timing of a fast rise or fall is hard to forecast.",
        "error",
    ),
    Signal(
        "big_revision",
        "Big revision",
        f"Forecast moved {BIG_REVISION_MW / 1000:.0f} GW or more since the previous run",
        "The forecast is unstable between runs.",
        "error",
    ),
    Signal(
        "low_wind_peak",
        "Low wind at evening peak",
        f"Forecast below {LOW_WIND_MW / 1000:.0f} GW between 16:00 and 19:00",
        "Low wind at peak demand has coincided with price spikes.",
        "price",
    ),
)


def flag_signals(df: pd.DataFrame) -> pd.DataFrame:
    """Add one boolean column per signal (sig_<key>)."""
    out = df.copy()
    forecast = out["forecast_mw"]
    by_day = forecast.groupby(out["delivery_day"])
    ramp_ahead = (by_day.shift(-RAMP_HOURS) - forecast).abs()
    ramp_behind = (forecast - by_day.shift(RAMP_HOURS)).abs()
    local_hour = out["start_time"].dt.tz_convert(LONDON).dt.hour

    out["sig_high_wind"] = forecast >= HIGH_WIND_MW
    out["sig_steep_ramp"] = (ramp_ahead >= RAMP_MW) | (ramp_behind >= RAMP_MW)
    out["sig_big_revision"] = out["revision_mw"].abs() >= BIG_REVISION_MW
    out["sig_low_wind_peak"] = (forecast < LOW_WIND_MW) & local_hour.isin(PEAK_HOURS)
    return out


def active_signals(row: pd.Series) -> list[str]:
    return [s.key for s in SIGNALS if row[f"sig_{s.key}"]]


def backtest(df: pd.DataFrame) -> list[dict]:
    """MAE and bias in flagged vs unflagged hours, with a verdict per signal."""
    scored = df.dropna(subset=["error_mw"])
    results = []
    for signal in SIGNALS:
        mask = scored[f"sig_{signal.key}"]
        flagged, other = scored.loc[mask, "error_mw"], scored.loc[~mask, "error_mw"]
        mae_flagged = float(flagged.abs().mean()) if len(flagged) else None
        mae_other = float(other.abs().mean()) if len(other) else None
        ratio = mae_flagged / mae_other if mae_flagged is not None and mae_other else None
        if signal.kind == "price":
            verdict = "price_risk"
        elif (
            len(flagged) >= SIGNAL_MIN_FLAGGED_HOURS
            and ratio is not None
            and ratio >= SIGNAL_MIN_MAE_RATIO
        ):
            verdict = "backed"
        else:
            verdict = "not_confirmed"
        results.append(
            {
                "key": signal.key,
                "title": signal.title,
                "rule": signal.rule,
                "meaning": signal.meaning,
                "kind": signal.kind,
                "flagged_hours": int(len(flagged)),
                "mae_flagged_mw": mae_flagged,
                "mae_other_mw": mae_other,
                "bias_flagged_mw": float(flagged.mean()) if len(flagged) else None,
                "mae_ratio": ratio,
                "verdict": verdict,
            }
        )
    return results
