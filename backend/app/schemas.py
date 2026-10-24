"""API response models. Power in MW, energy in GWh, timestamps in UTC."""

from datetime import date, datetime

from pydantic import BaseModel


class Preset(BaseModel):
    label: str
    time: str  # HH:MM, UK local time on D-1


class DatasetInfo(BaseModel):
    name: str
    description: str
    rows: int
    query: str


class Meta(BaseModel):
    first_delivery_day: date
    last_delivery_day: date
    default_cutoff: str
    presets: list[Preset]
    peak_hours: list[int]
    calibration_days: int
    data_fetched_at: datetime
    source: str
    datasets: list[DatasetInfo]


class HourRow(BaseModel):
    start_time: datetime
    local_time: str  # HH:MM UK time
    settlement_period: int
    lead_h: float
    publish_time: datetime | None
    forecast_mw: float | None
    adjusted_mw: float | None
    band_low_mw: float | None
    band_high_mw: float | None
    prev_publish_time: datetime | None
    prev_forecast_mw: float | None
    revision_mw: float | None
    level_bin: str | None
    actual_mw: float | None
    error_mw: float | None
    signals: list[str]


class HalfHour(BaseModel):
    start_time: datetime
    local_time: str
    settlement_period: int
    actual_mw: float


class PeakWindow(BaseModel):
    forecast_mw: float | None
    adjusted_mw: float | None
    plan_for_low_mw: float | None  # lowest band_low_mw in the window
    revision_mw: float | None
    actual_mw: float | None


class DaySummary(BaseModel):
    forecast_gwh: float | None
    adjusted_gwh: float | None
    actual_gwh: float | None
    mae_mw: float | None
    bias_mw: float | None


class CalibrationBin(BaseModel):
    label: str
    low_mw: float
    high_mw: float | None
    n_hours: int
    pooled_with: list[str]
    error_p10_mw: float
    error_p50_mw: float
    error_p90_mw: float


class Calibration(BaseModel):
    train_from: date
    train_to: date
    bins: list[CalibrationBin]


class DayView(BaseModel):
    delivery_day: date
    cutoff: str
    decision_time: datetime
    run_publish_time: datetime | None
    previous_run_publish_time: datetime | None
    hours: list[HourRow]
    half_hours: list[HalfHour]
    peak: PeakWindow
    summary: DaySummary
    calibration: Calibration


class Summary(BaseModel):
    hours: int
    mae_mw: float
    bias_mw: float
    rmse_mw: float
    wape_pct: float
    p90_abs_error_mw: float
    within_1gw_pct: float
    over_forecast_hours_pct: float
    mean_actual_mw: float
    mean_forecast_mw: float
    adjusted_mae_mw: float
    adjusted_improvement_pct: float
    band_coverage_pct: float


class GroupStats(BaseModel):
    group: str
    hours: int
    mae_mw: float
    bias_mw: float
    adjusted_mae_mw: float
    band_coverage_pct: float


class DailyStats(BaseModel):
    date: date
    mean_forecast_mw: float
    mean_adjusted_mw: float
    mean_actual_mw: float
    mae_mw: float
    bias_mw: float


class HeatCell(BaseModel):
    date: date
    hour: int
    error_mw: float | None


class Scorecard(BaseModel):
    cutoff: str
    summary: Summary
    by_lead: list[GroupStats]
    by_level: list[GroupStats]
    daily: list[DailyStats]
    heatmap: list[HeatCell]


class SignalResult(BaseModel):
    key: str
    title: str
    rule: str
    meaning: str
    kind: str
    flagged_hours: int
    mae_flagged_mw: float | None
    mae_other_mw: float | None
    bias_flagged_mw: float | None
    mae_ratio: float | None
    verdict: str  # backed | not_confirmed | price_risk


class SignalsReport(BaseModel):
    cutoff: str
    signals: list[SignalResult]
