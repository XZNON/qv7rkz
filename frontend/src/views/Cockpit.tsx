import { api, useApi } from '../api/client'
import type { DayView, Meta, SignalsReport } from '../api/types'
import { DayChart } from '../components/DayChart'
import { HourTable } from '../components/HourTable'
import { CutoffPicker, DayPicker } from '../components/Pickers'
import { Shell } from '../components/Shell'
import { SignalList } from '../components/SignalList'
import { Card, ErrorBox, SideSection, Skeleton, StatRow, Switch } from '../components/ui'
import { clock, dateLabel, dayLabel, duration, errorInWords, gw, signedGw } from '../lib/format'
import { stagger } from '../lib/motion'
import type { UrlState } from '../lib/urlState'

export function Cockpit({
  meta,
  state,
  update,
}: {
  meta: Meta
  state: UrlState
  update: (patch: Partial<UrlState>) => void
}) {
  const day = useApi<DayView>(api.day(state.date, state.cutoff))
  const signals = useApi<SignalsReport>(api.signals(state.cutoff))

  const sidebar = (
    <>
      <SideSection title="Delivery day">
        <DayPicker meta={meta} value={state.date} onChange={(date) => update({ date })} />
      </SideSection>
      <SideSection title="Decision time (UK, day before)">
        <CutoffPicker meta={meta} value={state.cutoff} onChange={(cutoff) => update({ cutoff })} />
      </SideSection>
      <SideSection title="Hindsight">
        <Switch
          label="Show what actually happened"
          checked={state.actual}
          onChange={(actual) => update({ actual })}
        />
      </SideSection>
      {day.data && <ForecastUsed day={day.data} />}
    </>
  )

  return (
    <Shell sidebar={sidebar}>
      {day.error && <ErrorBox message={day.error} />}
      {!day.data && !day.error && <CockpitSkeleton />}
      {day.data && (
        <div className={`space-y-4 transition-opacity duration-150 ${day.loading ? 'opacity-60' : ''}`}>
          <Summary day={day.data} showActual={state.actual} />

          <Card
            className="enter"
            style={stagger(1)}
            title={`Wind for ${dateLabel(day.data.delivery_day)}, as known at ${day.data.cutoff} the day before`}
            subtitle="GB national metered wind. Forecast hourly, actual half-hourly."
          >
            <DayChart day={day.data} showActual={state.actual} peakHours={meta.peak_hours} />
          </Card>

          <Card
            className="enter"
            style={stagger(2)}
            title="Warning signals"
            subtitle="Conditions visible at decision time, each tested against January outcomes."
          >
            {signals.data ? (
              <SignalList hours={day.data.hours} signals={signals.data.signals} />
            ) : (
              <Skeleton className="h-16" />
            )}
          </Card>

          <HourTable day={day.data} showActual={state.actual} style={stagger(3)} />
        </div>
      )}
    </Shell>
  )
}

function Summary({ day, showActual }: { day: DayView; showActual: boolean }) {
  const { peak, summary } = day
  const change =
    peak.revision_mw == null
      ? null
      : Math.abs(peak.revision_mw) < 100
        ? `unchanged since the ${clock(day.previous_run_publish_time)} run`
        : `${peak.revision_mw > 0 ? 'up' : 'down'} ${gw(Math.abs(peak.revision_mw))} since the ${clock(
            day.previous_run_publish_time,
          )} run`
  const belowPlan =
    peak.actual_mw != null && peak.plan_for_low_mw != null && peak.actual_mw < peak.plan_for_low_mw

  return (
    <Card className="enter" style={stagger(0)}>
      <p className="text-[13px] text-slate-500">
        {dateLabel(day.delivery_day)} · evening peak 16:00–19:00 · decided {day.cutoff} {dayLabel(day.decision_time)}
      </p>
      <p className="mt-1 text-xl leading-snug font-semibold text-balance text-slate-900">
        About {gw(peak.adjusted_mw)} of metered wind expected at the evening peak. Plan for at least{' '}
        {gw(peak.plan_for_low_mw)}.
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Raw forecast {gw(peak.forecast_mw)}
        {change && `, ${change}`}.
      </p>

      <StatRow
        className="mt-5 border-t border-slate-100 pt-4"
        items={[
          { label: 'Evening peak, expected', value: gw(peak.adjusted_mw), detail: `Raw forecast ${gw(peak.forecast_mw)}` },
          { label: 'Plan for at least', value: gw(peak.plan_for_low_mw), detail: 'Low end of the 80% range' },
          { label: 'Change since previous run', value: signedGw(peak.revision_mw), detail: `Peak average vs ${clock(day.previous_run_publish_time)}` },
          {
            label: 'Daily energy, expected',
            value: summary.adjusted_gwh == null ? '–' : `${summary.adjusted_gwh.toFixed(0)} GWh`,
            detail: `Raw forecast ${summary.forecast_gwh?.toFixed(0) ?? '–'} GWh`,
          },
        ]}
      />

      {showActual && (
        <StatRow
          className="mt-4 rounded-xl bg-slate-50 p-4"
          items={[
            {
              label: 'Evening peak, actual',
              value: gw(peak.actual_mw),
              tone: belowPlan ? 'warn' : 'good',
              detail: belowPlan ? 'Below the plan-for level' : 'At or above the plan-for level',
            },
            { label: 'Raw forecast, day average', value: signedGw(summary.bias_mw), detail: errorInWords(summary.bias_mw) },
            { label: 'Typical hourly miss', value: gw(summary.mae_mw), detail: 'Raw forecast vs actual' },
            {
              label: 'Daily energy, actual',
              value: summary.actual_gwh == null ? '–' : `${summary.actual_gwh.toFixed(0)} GWh`,
              detail: `Expected ${summary.adjusted_gwh?.toFixed(0) ?? '–'} GWh`,
            },
          ]}
        />
      )}
    </Card>
  )
}

function ForecastUsed({ day }: { day: DayView }) {
  const rows: [string, string][] = [
    ['Decision', `${day.cutoff} ${dayLabel(day.decision_time)}`],
    [
      'Run used',
      day.run_publish_time
        ? `${clock(day.run_publish_time)}, ${duration(day.run_publish_time, day.decision_time)} earlier`
        : 'none available',
    ],
    ['Previous run', clock(day.previous_run_publish_time)],
    [
      'Range learned from',
      `${dateLabel(day.calibration.train_from)} – ${dateLabel(day.calibration.train_to)}`,
    ],
  ]
  return (
    <SideSection title="Forecast used">
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-end font-medium text-slate-800 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Only runs published before the decision are used. The range comes from 30 settled days at the same
        decision time; nothing from the decision day onwards.
      </p>
    </SideSection>
  )
}

function CockpitSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-52" />
      <Skeleton className="h-[30rem]" />
    </div>
  )
}
