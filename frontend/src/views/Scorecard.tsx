import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { api, useApi } from '../api/client'
import type { DailyStats, GroupStats, HeatCell, Meta, Scorecard, SignalsReport } from '../api/types'
import { Controls } from '../components/Controls'
import { VerdictBadge } from '../components/SignalList'
import { Card, ErrorBox, Skeleton, Tile } from '../components/ui'
import { stagger } from '../lib/motion'
import { dateLabel, errorInWords, gw, pct, signedGw } from '../lib/format'
import { evidence } from '../lib/signals'
import { colors } from '../lib/theme'

export function ScorecardView({
  meta,
  cutoff,
  onCutoff,
  onOpenDay,
}: {
  meta: Meta
  cutoff: string
  onCutoff: (cutoff: string) => void
  onOpenDay: (date: string) => void
}) {
  const scorecard = useApi<Scorecard>(api.scorecard(cutoff))
  const signals = useApi<SignalsReport>(api.signals(cutoff))
  const data = scorecard.data

  return (
    <div className="space-y-5">
      <Card className="enter" style={stagger(0)}>
        <Controls
          meta={meta}
          date={meta.first_delivery_day}
          cutoff={cutoff}
          showDate={false}
          onChange={(patch) => patch.cutoff && onCutoff(patch.cutoff)}
        />
      </Card>

      {scorecard.error && <ErrorBox message={scorecard.error} />}
      {!data && !scorecard.error && <Skeleton className="h-96" />}
      {data && (
        <div className={`space-y-5 transition-opacity duration-150 ${scorecard.loading ? 'opacity-60' : ''}`}>
          <Kpis data={data} />

          <Card
            className="enter"
            style={stagger(3)}
            title={`Forecasts were too high on ${data.daily.filter((d) => d.bias_mw > 0).length} of ${data.daily.length} days`}
            subtitle="Average error per delivery day (forecast − actual). Bars: raw forecast. Dots: expected line. Click a day to open it."
          >
            <DailyChart daily={data.daily} onOpenDay={onOpenDay} />
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card
              className="enter"
              style={stagger(4)}
              title="Misses grow with the forecast level"
              subtitle="Typical miss (MAE) by forecast level, raw vs expected line"
            >
              <GroupChart groups={data.by_level} />
            </Card>
            <Card
              className="enter"
              style={stagger(4)}
              title="Lead time matters less than level"
              subtitle="Typical miss by hours from decision to delivery"
            >
              <GroupChart groups={data.by_lead} />
            </Card>
          </div>

          <Card
            className="enter"
            style={stagger(5)}
            title="Where the misses were"
            subtitle="Error by delivery day and UK hour. Orange: over-forecast (buyer short). Blue: under-forecast."
          >
            <Heatmap cells={data.heatmap} onOpenDay={onOpenDay} />
          </Card>

          <Card
            className="enter"
            style={stagger(6)}
            title="Which warning signals held up"
            subtitle="Each signal is visible at decision time. It counts as backed only if flagged hours had clearly larger misses."
          >
            {signals.data ? <SignalTable report={signals.data} /> : <Skeleton className="h-32" />}
          </Card>
        </div>
      )}
    </div>
  )
}

function Kpis({ data }: { data: Scorecard }) {
  const s = data.summary
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile style={stagger(1)} label="Typical miss (MAE)" value={gw(s.mae_mw)} detail={`${pct(s.wape_pct)} of average actual (WAPE)`} />
        <Tile
          style={stagger(1)}
          tone="warn"
          label="Average bias"
          value={signedGw(s.bias_mw)}
          detail={`Forecast too high in ${pct(s.over_forecast_hours_pct)} of hours`}
        />
        <Tile style={stagger(1)} label="1-in-10 miss" value={gw(s.p90_abs_error_mw)} detail="9 in 10 hours missed by less" />
        <Tile style={stagger(1)} label="Within ±1 GW" value={pct(s.within_1gw_pct)} detail={`of ${s.hours} delivery hours`} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Tile
          style={stagger(2)}
          tone="good"
          label="Expected line vs raw forecast"
          value={`${pct(s.adjusted_improvement_pct)} smaller misses`}
          detail={`Typical miss ${gw(s.adjusted_mae_mw)} instead of ${gw(s.mae_mw)}, learned only from earlier days`}
        />
        <Tile
          style={stagger(2)}
          label="80% range coverage"
          value={pct(s.band_coverage_pct)}
          detail="Share of hours where the actual fell inside the range (target 80%)"
        />
      </div>
    </div>
  )
}

const axisTick = { fontSize: 12, fill: colors.muted }

function DailyChart({ daily, onOpenDay }: { daily: DailyStats[]; onOpenDay: (date: string) => void }) {
  const rows = daily.map((d) => ({
    ...d,
    label: d.date.slice(8, 10),
    adjusted_bias_mw: d.mean_adjusted_mw - d.mean_actual_mw,
  }))
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
          onClick={(state) => {
            const index = state?.activeTooltipIndex
            if (index != null) onOpenDay(rows[Number(index)].date)
          }}
          className="cursor-pointer"
        >
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: colors.grid }} interval={1} />
          <YAxis
            tickFormatter={(v: number) => (v / 1000).toFixed(0)}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={44}
            label={{ value: 'GW', angle: -90, position: 'insideLeft', offset: 18, fontSize: 12, fill: colors.muted }}
          />
          <ReferenceLine y={0} stroke={colors.muted} />
          <Bar dataKey="bias_mw" isAnimationActive={false} radius={[3, 3, 0, 0]}>
            {rows.map((r) => (
              <Cell key={r.date} fill={r.bias_mw > 0 ? colors.over : colors.under} />
            ))}
          </Bar>
          <Scatter dataKey="adjusted_bias_mw" fill={colors.actual} isAnimationActive={false} />
          <Tooltip
            cursor={{ fill: 'oklch(0 0 0 / 0.04)' }}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined
              if (!row) return null
              return (
                <div className="surface rounded-xl px-3 py-2.5 text-sm shadow-lg">
                  <div className="font-semibold">{dateLabel(row.date)}</div>
                  <div className="mt-1 tabular-nums text-slate-700">
                    Raw forecast {errorInWords(row.bias_mw)} on average
                  </div>
                  <div className="tabular-nums text-slate-700">
                    Expected line {errorInWords(row.adjusted_bias_mw)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Forecast {gw(row.mean_forecast_mw)} · actual {gw(row.mean_actual_mw)} · click to open
                  </div>
                </div>
              )
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function GroupChart({ groups }: { groups: GroupStats[] }) {
  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={groups} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barGap={2}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="group" tick={axisTick} tickLine={false} axisLine={{ stroke: colors.grid }} />
            <YAxis
              tickFormatter={(v: number) => (v / 1000).toFixed(1)}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Bar dataKey="mae_mw" name="Raw forecast" fill={colors.forecast} fillOpacity={0.35} isAnimationActive={false} radius={[3, 3, 0, 0]} />
            <Bar dataKey="adjusted_mae_mw" name="Expected line" fill={colors.forecast} isAnimationActive={false} radius={[3, 3, 0, 0]} />
            <Tooltip
              cursor={{ fill: 'oklch(0 0 0 / 0.04)' }}
              content={({ active, payload }) => {
                const g = active ? (payload?.[0]?.payload as GroupStats | undefined) : undefined
                if (!g) return null
                return (
                  <div className="surface rounded-xl px-3 py-2.5 text-sm shadow-lg tabular-nums">
                    <div className="font-semibold">{g.group}</div>
                    <div className="text-slate-700">Raw forecast miss {gw(g.mae_mw)}</div>
                    <div className="text-slate-700">Expected line miss {gw(g.adjusted_mae_mw)}</div>
                    <div className="text-slate-700">Bias {signedGw(g.bias_mw)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {g.hours} hours · range caught {pct(g.band_coverage_pct)}
                    </div>
                  </div>
                )
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-forecast/35" /> Raw forecast
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-forecast" /> Expected line
        </span>
      </div>
    </div>
  )
}

const HEAT_CAP_MW = 6000

function heatColor(error: number | null): string {
  if (error == null) return 'transparent'
  const share = Math.round(Math.min(Math.abs(error) / HEAT_CAP_MW, 1) * 100)
  const base = error > 0 ? colors.over : colors.under
  return `color-mix(in oklab, ${base} ${share}%, white)`
}

function Heatmap({ cells, onOpenDay }: { cells: HeatCell[]; onOpenDay: (date: string) => void }) {
  const days = [...new Set(cells.map((c) => c.date))]
  const byKey = new Map(cells.map((c) => [`${c.date}|${c.hour}`, c.error_mw]))
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[4.5rem_repeat(24,minmax(0,1fr))] gap-px text-[10px] text-slate-500">
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center tabular-nums">
              {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
            </div>
          ))}
          {days.map((day) => (
            <Row key={day} day={day} byKey={byKey} onOpenDay={onOpenDay} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
          <span>Under-forecast</span>
          <span
            aria-hidden
            className="h-2.5 w-40 rounded-full"
            style={{
              background: `linear-gradient(to right, ${colors.under}, white, ${colors.over})`,
            }}
          />
          <span>Over-forecast (±{HEAT_CAP_MW / 1000} GW or more)</span>
        </div>
      </div>
    </div>
  )
}

function Row({
  day,
  byKey,
  onOpenDay,
}: {
  day: string
  byKey: Map<string, number | null>
  onOpenDay: (date: string) => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onOpenDay(day)}
        className="pe-2 text-start text-[11px] text-slate-600 tabular-nums hover:text-slate-900"
      >
        {dateLabel(day)}
      </button>
      {Array.from({ length: 24 }, (_, h) => {
        const error = byKey.get(`${day}|${h}`) ?? null
        return (
          <div
            key={h}
            title={`${dateLabel(day)} ${String(h).padStart(2, '0')}:00 · ${errorInWords(error)}`}
            className="h-4 rounded-[2px]"
            style={{ background: heatColor(error) }}
          />
        )
      })}
    </>
  )
}

function SignalTable({ report }: { report: SignalsReport }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="py-2 pe-4 font-medium">Signal</th>
            <th className="py-2 pe-4 font-medium">Rule</th>
            <th className="py-2 pe-4 text-end font-medium">Hours flagged</th>
            <th className="py-2 pe-4 text-end font-medium">Miss when flagged</th>
            <th className="py-2 pe-4 text-end font-medium">Miss otherwise</th>
            <th className="py-2 font-medium">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {report.signals.map((s) => (
            <tr key={s.key} className="border-b border-slate-100 align-top last:border-0">
              <td className="py-2.5 pe-4">
                <div className="font-medium text-slate-900">{s.title}</div>
                <div className="text-xs text-slate-500">{evidence(s)}</div>
              </td>
              <td className="py-2.5 pe-4 text-slate-600">{s.rule}</td>
              <td className="py-2.5 pe-4 text-end tabular-nums">{s.flagged_hours}</td>
              <td className="py-2.5 pe-4 text-end tabular-nums">{gw(s.mae_flagged_mw)}</td>
              <td className="py-2.5 pe-4 text-end tabular-nums">{gw(s.mae_other_mw)}</td>
              <td className="py-2.5">
                <VerdictBadge signal={s} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
