// Mirrors backend/app/schemas.py. Power in MW, energy in GWh, timestamps in UTC (ISO 8601).

export type Preset = { label: string; time: string }

export type DatasetInfo = { name: string; description: string; rows: number; query: string }

export type Meta = {
  first_delivery_day: string
  last_delivery_day: string
  default_cutoff: string
  presets: Preset[]
  peak_hours: number[]
  calibration_days: number
  data_fetched_at: string
  source: string
  datasets: DatasetInfo[]
}

export type SignalKey = 'high_wind' | 'steep_ramp' | 'big_revision' | 'low_wind_peak'

export type HourRow = {
  start_time: string
  local_time: string
  settlement_period: number
  lead_h: number
  publish_time: string | null
  forecast_mw: number | null
  adjusted_mw: number | null
  band_low_mw: number | null
  band_high_mw: number | null
  prev_publish_time: string | null
  prev_forecast_mw: number | null
  revision_mw: number | null
  level_bin: string | null
  actual_mw: number | null
  error_mw: number | null
  signals: SignalKey[]
}

export type HalfHour = {
  start_time: string
  local_time: string
  settlement_period: number
  actual_mw: number
}

export type CalibrationBin = {
  label: string
  low_mw: number
  high_mw: number | null
  n_hours: number
  pooled_with: string[]
  error_p10_mw: number
  error_p50_mw: number
  error_p90_mw: number
}

export type DayView = {
  delivery_day: string
  cutoff: string
  decision_time: string
  run_publish_time: string | null
  previous_run_publish_time: string | null
  hours: HourRow[]
  half_hours: HalfHour[]
  peak: {
    forecast_mw: number | null
    adjusted_mw: number | null
    plan_for_low_mw: number | null
    revision_mw: number | null
    actual_mw: number | null
  }
  summary: {
    forecast_gwh: number | null
    adjusted_gwh: number | null
    actual_gwh: number | null
    mae_mw: number | null
    bias_mw: number | null
  }
  calibration: { train_from: string; train_to: string; bins: CalibrationBin[] }
}

export type Summary = {
  hours: number
  mae_mw: number
  bias_mw: number
  rmse_mw: number
  wape_pct: number
  p90_abs_error_mw: number
  within_1gw_pct: number
  over_forecast_hours_pct: number
  mean_actual_mw: number
  mean_forecast_mw: number
  adjusted_mae_mw: number
  adjusted_improvement_pct: number
  band_coverage_pct: number
}

export type GroupStats = {
  group: string
  hours: number
  mae_mw: number
  bias_mw: number
  adjusted_mae_mw: number
  band_coverage_pct: number
}

export type DailyStats = {
  date: string
  mean_forecast_mw: number
  mean_adjusted_mw: number
  mean_actual_mw: number
  mae_mw: number
  bias_mw: number
}

export type HeatCell = { date: string; hour: number; error_mw: number | null }

export type Scorecard = {
  cutoff: string
  summary: Summary
  by_lead: GroupStats[]
  by_level: GroupStats[]
  daily: DailyStats[]
  heatmap: HeatCell[]
}

export type Verdict = 'backed' | 'not_confirmed' | 'price_risk'

export type SignalResult = {
  key: SignalKey
  title: string
  rule: string
  meaning: string
  kind: 'error' | 'price'
  flagged_hours: number
  mae_flagged_mw: number | null
  mae_other_mw: number | null
  bias_flagged_mw: number | null
  mae_ratio: number | null
  verdict: Verdict
}

export type SignalsReport = { cutoff: string; signals: SignalResult[] }
