"""Aligning forecasts with actuals and measuring error.

Sign convention: error = forecast - actual. Positive means over-forecast, so a
buyer who relied on the forecast under-bought.
"""

import pandas as pd


def hourly_actuals(actuals: pd.DataFrame) -> pd.Series:
    """Hourly actual (MW): mean of the hh:00 and hh:30 half-hours.

    WINDFOR is hourly and FUELHH half-hourly. An hour missing either half is
    null rather than a half-value.
    """
    series = actuals.set_index("start_time")["generation_mw"]
    grouped = series.groupby(series.index.floor("h"))
    return grouped.mean().where(grouped.count() == 2).rename("actual_mw")


def with_errors(selected: pd.DataFrame, hourly: pd.Series) -> pd.DataFrame:
    """Join hourly actuals onto selected forecasts and compute error_mw."""
    out = selected.copy()
    out["actual_mw"] = out["start_time"].map(hourly)
    out["error_mw"] = out["forecast_mw"] - out["actual_mw"]
    return out


def _scored(df: pd.DataFrame) -> pd.DataFrame:
    """Hours with both a forecast and an actual, forecast published before delivery."""
    scored = df.dropna(subset=["forecast_mw", "actual_mw"])
    return scored[scored["publish_time"] < scored["start_time"]]


def _stats(scored: pd.DataFrame) -> dict:
    err = scored["error_mw"]
    adjusted_err = scored["adjusted_mw"] - scored["actual_mw"]
    inside = scored["actual_mw"].between(scored["band_low_mw"], scored["band_high_mw"])
    return {
        "hours": len(scored),
        "mae_mw": float(err.abs().mean()),
        "bias_mw": float(err.mean()),
        "adjusted_mae_mw": float(adjusted_err.abs().mean()),
        "band_coverage_pct": float(inside.mean() * 100),
    }


def summarize(df: pd.DataFrame) -> dict:
    """Headline accuracy for a set of evaluated hours (needs calibration columns)."""
    scored = _scored(df)
    err = scored["error_mw"]
    stats = _stats(scored)
    mean_actual = float(scored["actual_mw"].mean())
    return {
        **stats,
        "rmse_mw": float((err**2).mean() ** 0.5),
        "wape_pct": stats["mae_mw"] / mean_actual * 100,
        "p90_abs_error_mw": float(err.abs().quantile(0.9)),
        "within_1gw_pct": float((err.abs() <= 1000).mean() * 100),
        "over_forecast_hours_pct": float((err > 0).mean() * 100),
        "mean_actual_mw": mean_actual,
        "mean_forecast_mw": float(scored["forecast_mw"].mean()),
        "adjusted_improvement_pct": (1 - stats["adjusted_mae_mw"] / stats["mae_mw"]) * 100,
    }


def breakdown(df: pd.DataFrame, key: pd.Series, order: list[str] | None = None) -> list[dict]:
    """Accuracy stats per group, e.g. per lead-time bucket or forecast level."""
    scored = _scored(df)
    groups = scored.groupby(key.loc[scored.index], sort=order is None)
    rows = {str(name): {"group": str(name), **_stats(group)} for name, group in groups}
    keys = order if order is not None else list(rows)
    return [rows[k] for k in keys if k in rows]


def lead_bucket(lead_h: pd.Series, width_h: int = 6) -> pd.Series:
    """Label lead time (hours from decision to delivery) in fixed-width buckets."""
    start = (lead_h // width_h * width_h).astype(int)
    return start.astype(str) + "-" + (start + width_h).astype(str) + " h"


def daily(df: pd.DataFrame) -> list[dict]:
    """Per delivery day: mean forecast and actual, MAE and bias."""
    scored = _scored(df)
    rows = []
    for day, group in scored.groupby("delivery_day"):
        err = group["error_mw"]
        rows.append(
            {
                "date": day.isoformat(),
                "mean_forecast_mw": float(group["forecast_mw"].mean()),
                "mean_adjusted_mw": float(group["adjusted_mw"].mean()),
                "mean_actual_mw": float(group["actual_mw"].mean()),
                "mae_mw": float(err.abs().mean()),
                "bias_mw": float(err.mean()),
            }
        )
    return rows
