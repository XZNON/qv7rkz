"""Build API responses from an Evaluation. Converts pandas values to plain JSON-safe types."""

import math
from datetime import date, datetime, time

import pandas as pd

from app import schemas
from app.analysis import evaluate
from app.calibration import training_days
from app.config import (
    CALIBRATION_DAYS,
    DEFAULT_CUTOFF,
    FIRST_DELIVERY_DAY,
    LAST_DELIVERY_DAY,
    LEVEL_LABELS,
    LONDON,
    PEAK_HOURS,
    PRESET_CUTOFFS,
)
from app.data import load_actuals, load_manifest
from app.metrics import breakdown, daily, lead_bucket, summarize
from app.selection import cutoff_utc
from app.signals import active_signals, backtest

DATASET_DESCRIPTIONS = {
    "WINDFOR": "NESO national wind generation forecast (hourly, 8 runs a day)",
    "FUELHH": "Metered wind generation outturn (half-hourly average MW)",
}


def fmt_time(t: time) -> str:
    return t.strftime("%H:%M")


def num(value: object) -> float | None:
    if value is None or pd.isna(value):
        return None
    return round(float(value), 1)


def ts(value: object) -> datetime | None:
    return None if value is None or pd.isna(value) else pd.Timestamp(value).to_pydatetime()


def mean_or_none(series: pd.Series) -> float | None:
    return None if series.isna().all() else float(series.mean())


def gwh(hourly_mw: pd.Series) -> float | None:
    """Energy of an hourly MW series (each value covers one hour)."""
    return None if hourly_mw.isna().any() else float(hourly_mw.sum() / 1000)


def local_labels(start: pd.Series) -> tuple[pd.Series, pd.Series]:
    """UK local HH:MM and settlement period (1-based half-hour of the local day)."""
    local = start.dt.tz_convert(LONDON)
    period = (local.dt.hour * 60 + local.dt.minute) // 30 + 1
    return local.dt.strftime("%H:%M"), period


def meta() -> schemas.Meta:
    manifest = load_manifest()
    return schemas.Meta(
        first_delivery_day=FIRST_DELIVERY_DAY,
        last_delivery_day=LAST_DELIVERY_DAY,
        default_cutoff=fmt_time(DEFAULT_CUTOFF),
        presets=[schemas.Preset(label=k, time=fmt_time(v)) for k, v in PRESET_CUTOFFS.items()],
        peak_hours=list(PEAK_HOURS),
        calibration_days=CALIBRATION_DAYS,
        data_fetched_at=manifest["fetched_at"],
        source=manifest["source"],
        datasets=[
            schemas.DatasetInfo(
                name=name,
                description=DATASET_DESCRIPTIONS[name],
                rows=info["rows"],
                query=info["query"],
            )
            for name, info in manifest["datasets"].items()
        ],
    )


def day_view(delivery_day: date, cutoff: time) -> schemas.DayView:
    evaluation = evaluate(cutoff)
    hours = evaluation.hours[evaluation.hours["delivery_day"] == delivery_day]
    local_time, period = local_labels(hours["start_time"])

    rows = [
        schemas.HourRow(
            start_time=ts(r.start_time),
            local_time=local_time.loc[i],
            settlement_period=int(period.loc[i]),
            lead_h=float(r.lead_h),
            publish_time=ts(r.publish_time),
            forecast_mw=num(r.forecast_mw),
            adjusted_mw=num(r.adjusted_mw),
            band_low_mw=num(r.band_low_mw),
            band_high_mw=num(r.band_high_mw),
            prev_publish_time=ts(r.prev_publish_time),
            prev_forecast_mw=num(r.prev_forecast_mw),
            revision_mw=num(r.revision_mw),
            level_bin=None if pd.isna(r.level_bin) else r.level_bin,
            actual_mw=num(r.actual_mw),
            error_mw=num(r.error_mw),
            signals=active_signals(hours.loc[i]),
        )
        for i, r in zip(hours.index, hours.itertuples(), strict=True)
    ]

    actuals = load_actuals()
    day_start, day_end = hours["start_time"].min(), hours["start_time"].max()
    window = actuals[
        (actuals["start_time"] >= day_start)
        & (actuals["start_time"] <= day_end + pd.Timedelta(minutes=30))
    ]
    hh_time, hh_period = local_labels(window["start_time"])
    half_hours = [
        schemas.HalfHour(
            start_time=ts(start),
            local_time=hh_time.loc[i],
            settlement_period=int(hh_period.loc[i]),
            actual_mw=float(mw),
        )
        for i, start, mw in zip(
            window.index, window["start_time"], window["generation_mw"], strict=True
        )
    ]

    local_hour = hours["start_time"].dt.tz_convert(LONDON).dt.hour
    peak = hours[local_hour.isin(PEAK_HOURS)]
    publish_times = hours["publish_time"].dropna()
    prev_times = hours["prev_publish_time"].dropna()
    train = training_days(delivery_day)

    return schemas.DayView(
        delivery_day=delivery_day,
        cutoff=fmt_time(cutoff),
        decision_time=ts(cutoff_utc(delivery_day, cutoff)),
        run_publish_time=ts(publish_times.mode().iloc[0]) if len(publish_times) else None,
        previous_run_publish_time=ts(prev_times.mode().iloc[0]) if len(prev_times) else None,
        hours=rows,
        half_hours=half_hours,
        peak=schemas.PeakWindow(
            forecast_mw=mean_or_none(peak["forecast_mw"]),
            adjusted_mw=mean_or_none(peak["adjusted_mw"]),
            plan_for_low_mw=None if peak.empty else num(peak["band_low_mw"].min()),
            revision_mw=mean_or_none(peak["revision_mw"]),
            actual_mw=mean_or_none(peak["actual_mw"]),
        ),
        summary=schemas.DaySummary(
            forecast_gwh=gwh(hours["forecast_mw"]),
            adjusted_gwh=gwh(hours["adjusted_mw"]),
            actual_gwh=gwh(hours["actual_mw"]),
            mae_mw=mean_or_none(hours["error_mw"].abs()),
            bias_mw=mean_or_none(hours["error_mw"]),
        ),
        calibration=schemas.Calibration(
            train_from=train[0],
            train_to=train[-1],
            bins=[
                schemas.CalibrationBin(
                    label=b.label,
                    low_mw=b.low_mw,
                    high_mw=b.high_mw,
                    n_hours=b.n_hours,
                    pooled_with=list(b.pooled_with),
                    error_p10_mw=b.q10,
                    error_p50_mw=b.q50,
                    error_p90_mw=b.q90,
                )
                for b in evaluation.bins_by_day[delivery_day]
            ],
        ),
    )


def scorecard(cutoff: time) -> schemas.Scorecard:
    hours = evaluate(cutoff).hours
    local_hour = hours["start_time"].dt.tz_convert(LONDON).dt.hour
    buckets = lead_bucket(hours["lead_h"])
    bucket_order = sorted(buckets.unique(), key=lambda label: int(label.split("-")[0]))
    heatmap = [
        schemas.HeatCell(date=day, hour=int(hour), error_mw=num(err))
        for day, hour, err in zip(hours["delivery_day"], local_hour, hours["error_mw"], strict=True)
    ]
    return schemas.Scorecard(
        cutoff=fmt_time(cutoff),
        summary=schemas.Summary(**summarize(hours)),
        by_lead=breakdown(hours, buckets, bucket_order),
        by_level=breakdown(hours, hours["level_bin"], list(LEVEL_LABELS)),
        daily=daily(hours),
        heatmap=heatmap,
    )


def signals_report(cutoff: time) -> schemas.SignalsReport:
    results = backtest(evaluate(cutoff).hours)
    for r in results:  # JSON has no NaN
        for key, value in r.items():
            if isinstance(value, float) and math.isnan(value):
                r[key] = None
    return schemas.SignalsReport(cutoff=fmt_time(cutoff), signals=results)
