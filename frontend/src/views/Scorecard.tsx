import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { api, useApi } from '../api/client'
import type { DailyStats, GroupStats, HeatCell, Meta, Scorecard, SignalsReport } from '../api/types'
import { CutoffPicker } from '../components/Pickers'
import { Shell } from '../components/Shell'
import { VerdictBadge } from '../components/SignalList'
import { Card, ErrorBox, SideSection, Skeleton, StatRow } from '../components/ui'
import { dateLabel, errorInWords, gw, pct, signedGw } from '../lib/format'
import { stagger } from '../lib/motion'
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

  const sidebar = (
    <>
      <SideSection title="Decision time (UK, day before)">
        <CutoffPicker meta={meta} value={cutoff} onChange={onCutoff} />
      </SideSection>
      <SideSection title="What is scored">
        <p className="text-sm leading-relaxed text-slate-600">
          Every hour of the delivery days {dateLabel(meta.first_delivery_day)} – {dateLabel(meta.last_delivery_day)},
          using the forecast that was available at the decision time. Error is forecast minus metered actual, so a
          positive error means the forecast was too high.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          One month is a small sample, so treat these figures as indicative.
        </p>
      </SideSection>
    </>
  )

  return (
    <Shell sidebar={sidebar}>
      {scorecard.error && <ErrorBox message={scorecard.error} />}
      {!data && !scorecard.error && <Skeleton className="h-96" />}
      {data && (
        <div className={`space-y-4 transition-opacity duration-150 ${scorecard.loading ? 'opacity-60' : ''}`}>
          <Summary data={data} />

          <Card
            className="enter"
            style={stagger(1)}
            title={`Forecasts were too high on ${data.daily.filter((d) => d.bias_mw > 0).length} of ${data.daily.length} days`}
            subtitle="Average error per delivery day, forecast − actual. Bars: raw forecast. Dots: expected line. Select a day to open it."
          >
            <DailyChart daily={data.daily} onOpenDay={onOpenDay} />
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card
              className="enter"
              style={stagger(2)}
              title="Misses grow with the forecast level"
              subtitle="Typical miss by forecast level"
            >
              <GroupChart groups={data.by_level} />
            </Card>
            <Card
              className="enter"
              style={stagger(2)}
              title="Misses by lead time"
              subtitle="Typical miss by hours from decision to delivery"
            >
              <GroupChart groups={data.by_lead} />
            </Card>
          </div>

          <Card
            className="enter"
            style={stagger(3)}
            title="Where the misses were"
            subtitle="Error by delivery day and UK hour. Orange: forecast too high (buyer short). Blue: too low."
          >
            <Heatmap cells={data.heatmap} onOpenDay={onOpenDay} />
          </Card>

          <Card
            className="enter"
            style={stagger(4)}
            title="Which warning signals held up"
            subtitle="A signal counts as backed only if flagged hours had clearly larger misses."
          >
            {signals.data ? <SignalTable report={signals.data} /> : <Skeleton className="h-32" />}
          </Card>
        </div>
      )}
    </Shell>
  )
}

function Summary({ data }: { data: Scorecard }) {
  const s = data.summary
  return (
    <Card className="enter" style={stagger(0)}>
      <p className="text-[13px] text-slate-500">
        January 2026 · {s.hours} delivery hours · forecast available at {data.cutoff} the day before
      </p>
      <p className="mt-1 text-xl leading-snug font-semibold text-balance text-slate-900">
        The forecast missed by {gw(s.mae_mw)} in a typical hour and ran {gw(s.bias_mw)} high on average. Correcting
        for past bias cut the typical miss by {pct(s.adjusted_improvement_pct)}.
      </p>
      <StatRow
        className="mt-5 border-t border-slate-100 pt-4"
        items={[
          { label: 'Typical miss (MAE)', value: gw(s.mae_mw), detail: `${pct(s.wape_pct)} of average actual` },
          {
            label: 'Average bias',
            value: signedGw(s.bias_mw),
            tone: 'warn',
            detail: `Too high in ${pct(s.over_forecast_hours_pct)} of hours`,
          },
          { label: '1-in-10 miss', value: gw(s.p90_abs_error_mw), detail: '9 in 10 hours missed by less' },
          { label: 'Within ±1 GW', value: pct(s.within_1gw_pct), detail: 'Share of hours' },
        ]}
      />
      <StatRow
        className="mt-4 rounded-xl bg-slate-50 p-4"
        items={[
          {
            label: 'Expected line, typical miss',
            value: gw(s.adjusted_mae_mw),
            tone: 'good',
            detail: `${pct(s.adjusted_improvement_pct)} smaller than raw`,
          },
          {
            label: '80% range coverage',
            value: pct(s.band_coverage_pct),
            detail: 'Hours where the actual fell inside (target 80%)',
          },
          { label: 'RMSE', value: gw(s.rmse_mw), detail: 'Weights large misses more' },
        ]}
      />
    </Card>
  )
}

const axisTick = { fontSize: 12, fill: colors.muted }
const toGw = (mw: number) => mw / 1000

function DailyChart({ daily, onOpenDay }: { daily: DailyStats[]; onOpenDay: (date: string) => void }) {
  const rows = daily.map((d) => ({
    ...d,
    label: d.date.slice(8, 10),
    bias_gw: toGw(d.bias_mw),
    adjusted_bias_gw: toGw(d.mean_adjusted_mw - d.mean_actual_mw),
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
            allowDecimals={false}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={44}
            label={{ value: 'GW', angle: -90, position: 'insideLeft', offset: 18, fontSize: 12, fill: colors.muted }}
          />
          <ReferenceLine y={0} stroke={colors.muted} />
          <Bar dataKey="bias_gw" isAnimationActive={false} radius={[2, 2, 0, 0]} maxBarSize={28}>
            {rows.map((r) => (
              <Cell key={r.date} fill={r.bias_mw > 0 ? colors.over : colors.under} fillOpacity={0.8} />
            ))}
          </Bar>
          <Scatter dataKey="adjusted_bias_gw" fill={colors.actual} isAnimationActive={false} />
          <Tooltip
            cursor={{ fill: 'oklch(0 0 0 / 0.04)' }}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined
              if (!row) return null
              return (
                <div className="popover rounded-xl px-3 py-2.5 text-sm">
                  <div className="font-semibold">{dateLabel(row.date)}</div>
                  <div className="mt-1 text-slate-700 tabular-nums">Raw forecast {errorInWords(row.bias_mw)} on average</div>
                  <div className="text-slate-700 tabular-nums">
                    Expected line {errorInWords(row.adjusted_bias_gw * 1000)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Forecast {gw(row.mean_forecast_mw)} · actual {gw(row.mean_actual_mw)} · select to open
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
  const rows = groups.map((g) => ({ ...g, raw_gw: toGw(g.mae_mw), adjusted_gw: toGw(g.adjusted_mae_mw) }))
  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barGap={2}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="group" tick={axisTick} tickLine={false} axisLine={{ stroke: colors.grid }} />
            <YAxis
              tickFormatter={(v: number) => v.toFixed(1)}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={44}
              label={{ value: 'GW', angle: -90, position: 'insideLeft', offset: 18, fontSize: 12, fill: colors.muted }}
            />
            <Bar dataKey="raw_gw" fill={colors.forecast} fillOpacity={0.3} isAnimationActive={false} radius={[2, 2, 0, 0]} maxBarSize={40} />
            <Bar dataKey="adjusted_gw" fill={colors.forecast} fillOpacity={0.85} isAnimationActive={false} radius={[2, 2, 0, 0]} maxBarSize={40} />
            <Tooltip
              cursor={{ fill: 'oklch(0 0 0 / 0.04)' }}
              content={({ active, payload }) => {
                const g = active ? (payload?.[0]?.payload as GroupStats | undefined) : undefined
                if (!g) return null
                return (
                  <div className="popover rounded-xl px-3 py-2.5 text-sm tabular-nums">
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
          <span aria-hidden className="size-3 rounded-sm bg-forecast/30" /> Raw forecast
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-forecast/85" /> Expected line
        </span>
      </div>
    </div>
  )
}

const HEAT_CAP_MW = 6000

function heatColor(error: number | null): string {
  if (error == null) return 'transparent'
  const share = Math.round(Math.min(Math.abs(error) / HEAT_CAP_MW, 1) * 85)
  const base = error > 0 ? colors.over : colors.under
  return `color-mix(in oklab, ${base} ${share}%, white)`
}

function Heatmap({ cells, onOpenDay }: { cells: HeatCell[]; onOpenDay: (date: string) => void }) {
  const days = [...new Set(cells.map((c) => c.date))]
  const byKey = new Map(cells.map((c) => [`${c.date}|${c.hour}`, c.error_mw]))
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[5rem_repeat(24,minmax(0,1fr))] gap-px text-[11px] text-slate-500">
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="pb-1 text-center tabular-nums">
              {h % 3 === 0 ? `${String(h).padStart(2, '0')}:00` : ''}
            </div>
          ))}
          {days.map((day) => (
            <HeatRow key={day} day={day} byKey={byKey} onOpenDay={onOpenDay} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
          <span>Too low</span>
          <span
            aria-hidden
            className="h-2.5 w-40 rounded-full"
            style={{
              background: `linear-gradient(to right, ${heatColor(-HEAT_CAP_MW)}, white, ${heatColor(HEAT_CAP_MW)})`,
            }}
          />
          <span>Too high (±{HEAT_CAP_MW / 1000} GW or more)</span>
        </div>
      </div>
    </div>
  )
}

function HeatRow({
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
        className="pe-2 text-start text-slate-600 tabular-nums hover:text-slate-900"
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
