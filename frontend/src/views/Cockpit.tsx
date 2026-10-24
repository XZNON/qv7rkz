import { Clock, Eye, EyeOff } from 'lucide-react'

import { api, useApi } from '../api/client'
import type { DayView, Meta, SignalsReport } from '../api/types'
import { Controls } from '../components/Controls'
import { DayChart } from '../components/DayChart'
import { HourTable } from '../components/HourTable'
import { SignalList } from '../components/SignalList'
import { Card, ErrorBox, Skeleton, Tile } from '../components/ui'
import { stagger } from '../lib/motion'
import { clock, dateLabel, dayLabel, duration, errorInWords, gw, signedGw } from '../lib/format'
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

  return (
    <div className="space-y-5">
      <Card className="enter" style={stagger(0)}>
        <Controls meta={meta} date={state.date} cutoff={state.cutoff} onChange={update} />
      </Card>

      {day.error && <ErrorBox message={day.error} />}
      {!day.data && !day.error && <CockpitSkeleton />}
      {day.data && (
        <div className={`space-y-5 transition-opacity duration-150 ${day.loading ? 'opacity-60' : ''}`}>
          <Provenance day={day.data} />
          <Headline day={day.data} />
          <PeakTiles day={day.data} />
          {state.actual && <WhatHappened day={day.data} />}

          <Card
            className="enter"
            style={stagger(4)}
            title={`Wind for ${dateLabel(day.data.delivery_day)}, as known at ${day.data.cutoff} the day before`}
            subtitle="National metered wind, GB. Forecast hourly, actual half-hourly."
            action={
              <button
                type="button"
                aria-pressed={state.actual}
                onClick={() => update({ actual: !state.actual })}
                className={`press flex items-center gap-2 rounded-lg ps-3 pe-3.5 py-2 text-sm font-medium ${
                  state.actual
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
              >
                {state.actual ? (
                  <EyeOff size={16} strokeWidth={2} absoluteStrokeWidth aria-hidden />
                ) : (
                  <Eye size={16} strokeWidth={2} absoluteStrokeWidth aria-hidden />
                )}
                {state.actual ? 'Hide what happened' : 'Show what actually happened'}
              </button>
            }
          >
            <DayChart day={day.data} showActual={state.actual} peakHours={meta.peak_hours} />
          </Card>

          <Card
            className="enter"
            style={stagger(5)}
            title="Warning signals"
            subtitle="Conditions visible at decision time, each tested against January outcomes."
          >
            {signals.data ? (
              <SignalList hours={day.data.hours} signals={signals.data.signals} />
            ) : (
              <Skeleton className="h-16" />
            )}
          </Card>

          <Card className="enter" style={stagger(6)}>
            <HourTable day={day.data} showActual={state.actual} />
          </Card>

          <CalibrationNote day={day.data} />
        </div>
      )}
    </div>
  )
}

function Provenance({ day }: { day: DayView }) {
  return (
    <div className="enter flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600" style={stagger(1)}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 shadow-[var(--shadow-border)]">
        <Clock size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
        Forecast as known at <strong className="font-semibold text-slate-900">{day.cutoff}</strong>{' '}
        {dayLabel(day.decision_time)}
      </span>
      {day.run_publish_time && (
        <span>
          · run published {clock(day.run_publish_time)} ({duration(day.run_publish_time, day.decision_time)} before
          the decision)
        </span>
      )}
    </div>
  )
}

function Headline({ day }: { day: DayView }) {
  const { peak } = day
  const change =
    peak.revision_mw == null
      ? null
      : Math.abs(peak.revision_mw) < 100
        ? `Unchanged since the ${clock(day.previous_run_publish_time)} run.`
        : `${peak.revision_mw > 0 ? 'Up' : 'Down'} ${gw(Math.abs(peak.revision_mw))} since the ${clock(
            day.previous_run_publish_time,
          )} run.`
  return (
    <div className="enter" style={stagger(2)}>
      <p className="max-w-3xl text-xl leading-snug font-semibold text-balance text-slate-900 sm:text-2xl">
        Evening peak: about {gw(peak.adjusted_mw)} of metered wind expected{' '}
        <span className="font-normal text-slate-500">(raw forecast {gw(peak.forecast_mw)})</span>. Plan for at least{' '}
        {gw(peak.plan_for_low_mw)}.
      </p>
      {change && <p className="mt-1 text-slate-600">{change}</p>}
    </div>
  )
}

function PeakTiles({ day }: { day: DayView }) {
  const { peak, summary } = day
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        style={stagger(3)}
        label="Evening peak, expected"
        value={gw(peak.adjusted_mw)}
        detail={`Raw forecast ${gw(peak.forecast_mw)} · 16:00–19:00`}
      />
      <Tile
        style={stagger(3)}
        label="Plan for at least"
        value={gw(peak.plan_for_low_mw)}
        detail="Lowest point of the 80% range in the peak"
      />
      <Tile
        style={stagger(3)}
        label="Change since previous run"
        value={signedGw(peak.revision_mw)}
        detail={`Peak average vs the ${clock(day.previous_run_publish_time)} run`}
      />
      <Tile
        style={stagger(3)}
        label="Daily energy, expected"
        value={summary.adjusted_gwh == null ? '–' : `${summary.adjusted_gwh.toFixed(0)} GWh`}
        detail={`Raw forecast ${summary.forecast_gwh?.toFixed(0) ?? '–'} GWh`}
      />
    </div>
  )
}

function WhatHappened({ day }: { day: DayView }) {
  const { peak, summary } = day
  const belowPlan =
    peak.actual_mw != null && peak.plan_for_low_mw != null && peak.actual_mw < peak.plan_for_low_mw
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Tile
        tone={belowPlan ? 'warn' : 'good'}
        label="Evening peak, actual"
        value={gw(peak.actual_mw)}
        detail={belowPlan ? 'Below the plan-for-at-least level' : 'At or above the plan-for-at-least level'}
      />
      <Tile
        label="Day average, raw forecast"
        value={errorInWords(summary.bias_mw)}
        detail={`Typical hourly miss ${gw(summary.mae_mw)}`}
      />
      <Tile
        label="Daily energy, actual"
        value={summary.actual_gwh == null ? '–' : `${summary.actual_gwh.toFixed(0)} GWh`}
        detail={`Expected ${summary.adjusted_gwh?.toFixed(0) ?? '–'} GWh`}
      />
    </div>
  )
}

function CalibrationNote({ day }: { day: DayView }) {
  const { calibration } = day
  return (
    <p className="text-xs text-slate-500">
      Expected line and range learned from the 30 delivery days {dateLabel(calibration.train_from)} –{' '}
      {dateLabel(calibration.train_to)}, all settled before this decision, using the forecast available at the
      same time of day.
    </p>
  )
}

function CockpitSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-16" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  )
}
