import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { DayView, HalfHour, HourRow } from '../api/types'
import { clock, errorInWords, gw } from '../lib/format'
import { colors } from '../lib/theme'

type Point = {
  x: number // minutes since UK midnight
  forecast: number | null
  adjusted: number | null
  band: [number, number] | null
  prev: number | null
  actual: number | null
  // Fill between forecast and actual, split by sign. Zero height when not applicable,
  // so the step areas stay continuous.
  over: [number, number] | null
  under: [number, number] | null
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

function buildPoints(day: DayView): Point[] {
  const hourAt = new Map<number, HourRow>(day.hours.map((h) => [minutes(h.local_time), h]))
  const halfAt = new Map<number, HalfHour>(day.half_hours.map((h) => [minutes(h.local_time), h]))
  const points: Point[] = []
  for (let x = 0; x < 24 * 60; x += 30) {
    const hour = hourAt.get(x - (x % 60))
    const actual = halfAt.get(x)?.actual_mw ?? null
    const forecast = hour?.forecast_mw ?? null
    const both = forecast != null && actual != null
    points.push({
      x,
      forecast,
      adjusted: hour?.adjusted_mw ?? null,
      band:
        hour?.band_low_mw != null && hour.band_high_mw != null
          ? [hour.band_low_mw, hour.band_high_mw]
          : null,
      prev: hour?.prev_forecast_mw ?? null,
      actual,
      over: both ? [actual, Math.max(forecast, actual)] : null,
      under: both ? [forecast, Math.max(forecast, actual)] : null,
    })
  }
  // Closing point so the last half-hour's step is drawn to midnight.
  points.push({ ...points[points.length - 1], x: 24 * 60 })
  return points
}

const ticks = [0, 180, 360, 540, 720, 900, 1080, 1260, 1440]
const tickLabel = (x: number) => `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:00`

export function DayChart({
  day,
  showActual,
  peakHours,
}: {
  day: DayView
  showActual: boolean
  peakHours: number[]
}) {
  const points = buildPoints(day)
  const peakStart = Math.min(...peakHours) * 60
  const peakEnd = (Math.max(...peakHours) + 1) * 60

  return (
    <div>
      <Legend showActual={showActual} />
      <div className="mt-3 h-80 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <ReferenceArea
              x1={peakStart}
              x2={peakEnd}
              fill={colors.peak}
              fillOpacity={0.05}
              label={{
                value: 'Evening peak',
                position: 'insideTop',
                fontSize: 11,
                fill: colors.muted,
              }}
            />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 1440]}
              ticks={ticks}
              tickFormatter={tickLabel}
              tick={{ fontSize: 12, fill: colors.muted }}
              tickLine={false}
              axisLine={{ stroke: colors.grid }}
            />
            <YAxis
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}`}
              tick={{ fontSize: 12, fill: colors.muted }}
              tickLine={false}
              axisLine={false}
              width={44}
              label={{
                value: 'GW',
                angle: -90,
                position: 'insideLeft',
                offset: 18,
                fontSize: 12,
                fill: colors.muted,
              }}
            />

            <Area
              dataKey="band"
              type="stepAfter"
              stroke="none"
              fill={colors.band}
              fillOpacity={0.14}
              isAnimationActive={false}
              activeDot={false}
            />
            {showActual && (
              <>
                <Area
                  dataKey="over"
                  type="stepAfter"
                  stroke="none"
                  fill={colors.over}
                  fillOpacity={0.3}
                  isAnimationActive={false}
                  activeDot={false}
                />
                <Area
                  dataKey="under"
                  type="stepAfter"
                  stroke="none"
                  fill={colors.under}
                  fillOpacity={0.35}
                  isAnimationActive={false}
                  activeDot={false}
                />
              </>
            )}
            <Line
              dataKey="prev"
              type="stepAfter"
              stroke={colors.previous}
              strokeWidth={1.25}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="forecast"
              type="stepAfter"
              stroke={colors.forecast}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="adjusted"
              type="stepAfter"
              stroke={colors.adjusted}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
            {showActual && (
              <Line
                dataKey="actual"
                type="stepAfter"
                stroke={colors.actual}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Tooltip
              cursor={{ stroke: colors.muted, strokeDasharray: '3 3' }}
              content={({ active, label }) =>
                active && typeof label === 'number' ? (
                  <ChartTooltip day={day} x={label} showActual={showActual} />
                ) : null
              }
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ChartTooltip({ day, x, showActual }: { day: DayView; x: number; showActual: boolean }) {
  const slot = Math.min(x, 1410)
  const hour = day.hours.find((h) => minutes(h.local_time) === slot - (slot % 60))
  const half = day.half_hours.find((h) => minutes(h.local_time) === slot - (slot % 30))
  if (!hour) return null
  const end = tickLabel(minutes(hour.local_time) + 60)
  return (
    <div className="popover max-w-72 rounded-xl px-3 py-2.5 text-sm">
      <div className="font-semibold tabular-nums">
        {hour.local_time}–{end}{' '}
        <span className="font-normal text-slate-500">
          · SP {hour.settlement_period}–{hour.settlement_period + 1}
        </span>
      </div>
      <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        <dt className="text-slate-500">Forecast at {day.cutoff}</dt>
        <dd className="text-end">{gw(hour.forecast_mw)}</dd>
        <dt className="text-slate-500">Expected metered</dt>
        <dd className="text-end font-medium">{gw(hour.adjusted_mw)}</dd>
        <dt className="text-slate-500">80% range</dt>
        <dd className="text-end">
          {gw(hour.band_low_mw)} – {gw(hour.band_high_mw)}
        </dd>
        <dt className="text-slate-500">Previous run</dt>
        <dd className="text-end">{gw(hour.prev_forecast_mw)}</dd>
        {showActual && (
          <>
            <dt className="text-slate-500">Actual {half ? half.local_time : ''}</dt>
            <dd className="text-end font-medium">{gw(half?.actual_mw)}</dd>
          </>
        )}
      </dl>
      {showActual && <div className="mt-1.5 text-slate-700">Hour {errorInWords(hour.error_mw)}</div>}
      <div className="mt-1.5 text-xs text-slate-500">
        Run published {clock(hour.publish_time)} · {hour.lead_h.toFixed(1)} h ahead of delivery
      </div>
    </div>
  )
}

function Swatch({ kind }: { kind: 'dashed' | 'solid' | 'thin' | 'band' | 'actual' | 'over' | 'under' }) {
  if (kind === 'band' || kind === 'over' || kind === 'under') {
    const fill = { band: colors.band, over: colors.over, under: colors.under }[kind]
    const opacity = { band: 0.2, over: 0.35, under: 0.4 }[kind]
    return (
      <svg width="22" height="12" aria-hidden>
        <rect width="22" height="12" rx="2" fill={fill} fillOpacity={opacity} />
      </svg>
    )
  }
  const stroke = { dashed: colors.forecast, solid: colors.adjusted, thin: colors.previous, actual: colors.actual }[kind]
  return (
    <svg width="22" height="12" aria-hidden>
      <line
        x1="0"
        x2="22"
        y1="6"
        y2="6"
        stroke={stroke}
        strokeWidth={kind === 'thin' ? 1.25 : kind === 'solid' ? 2.5 : 2}
        strokeDasharray={kind === 'dashed' ? '6 4' : undefined}
      />
    </svg>
  )
}

function Legend({ showActual }: { showActual: boolean }) {
  const items: { kind: Parameters<typeof Swatch>[0]['kind']; label: string }[] = [
    { kind: 'dashed', label: 'Forecast at decision time' },
    { kind: 'solid', label: 'Expected metered wind (adjusted for past bias)' },
    { kind: 'band', label: '80% range: 8 in 10 past outcomes fell inside' },
    { kind: 'thin', label: 'Previous run' },
  ]
  if (showActual) {
    items.push(
      { kind: 'actual', label: 'Actual (metered)' },
      { kind: 'over', label: 'Over-forecast (you were short)' },
      { kind: 'under', label: 'Under-forecast (you were long)' },
    )
  }
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <Swatch kind={item.kind} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
