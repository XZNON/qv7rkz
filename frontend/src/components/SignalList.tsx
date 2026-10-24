import { CircleCheck, CircleHelp, TriangleAlert } from 'lucide-react'

import type { HourRow, SignalKey, SignalResult } from '../api/types'
import { evidence } from '../lib/signals'
import { Badge } from './ui'

/** "17:00–21:00, 23:00–24:00" from the hours where a signal is active. */
function hourRanges(hours: HourRow[], key: SignalKey): string {
  const flagged = hours.filter((h) => h.signals.includes(key)).map((h) => Number(h.local_time.slice(0, 2)))
  const ranges: [number, number][] = []
  for (const h of flagged) {
    const last = ranges[ranges.length - 1]
    if (last && h === last[1] + 1) last[1] = h
    else ranges.push([h, h])
  }
  const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`
  return ranges.map(([a, b]) => `${fmt(a)}–${fmt(b + 1)}`).join(', ')
}

export function VerdictBadge({ signal }: { signal: SignalResult }) {
  if (signal.verdict === 'backed') {
    return (
      <Badge tone="good">
        <CircleCheck size={12} strokeWidth={2} absoluteStrokeWidth aria-hidden />
        Backed by January data
      </Badge>
    )
  }
  if (signal.verdict === 'price_risk') {
    return (
      <Badge tone="warn">
        <TriangleAlert size={12} strokeWidth={2} absoluteStrokeWidth aria-hidden />
        Price risk
      </Badge>
    )
  }
  return (
    <Badge tone="neutral">
      <CircleHelp size={12} strokeWidth={2} absoluteStrokeWidth aria-hidden />
      Not confirmed by January data
    </Badge>
  )
}

export function SignalList({ hours, signals }: { hours: HourRow[]; signals: SignalResult[] }) {
  const active = signals.filter((s) => hours.some((h) => h.signals.includes(s.key)))
  if (active.length === 0) {
    return <p className="text-sm text-slate-600">No warning signals for this day.</p>
  }
  return (
    <ul className="divide-y divide-slate-100">
      {active.map((signal) => (
        <li key={signal.key} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
          <div className="sm:w-56 sm:shrink-0">
            <div className="font-medium text-slate-900">{signal.title}</div>
            <div className="text-sm text-slate-500 tabular-nums">{hourRanges(hours, signal.key)}</div>
          </div>
          <div className="flex-1 text-sm text-slate-700">
            <p>{signal.meaning}</p>
            <p className="mt-0.5 text-slate-500">{evidence(signal)}</p>
          </div>
          <div className="sm:shrink-0">
            <VerdictBadge signal={signal} />
          </div>
        </li>
      ))}
    </ul>
  )
}
