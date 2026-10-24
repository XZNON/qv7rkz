import { Download } from 'lucide-react'

import type { DayView } from '../api/types'
import { gw, signedGw } from '../lib/format'

function toCsv(day: DayView, showActual: boolean): string {
  const header = [
    'uk_time',
    'settlement_period',
    'forecast_mw',
    'expected_metered_mw',
    'range_low_mw',
    'range_high_mw',
    'previous_run_mw',
    'run_published_utc',
    ...(showActual ? ['actual_mw', 'error_mw'] : []),
    'signals',
  ]
  const rows = day.hours.map((h) => [
    h.local_time,
    h.settlement_period,
    h.forecast_mw,
    h.adjusted_mw,
    h.band_low_mw,
    h.band_high_mw,
    h.prev_forecast_mw,
    h.publish_time,
    ...(showActual ? [h.actual_mw, h.error_mw] : []),
    h.signals.join(' '),
  ])
  return [header, ...rows].map((r) => r.map((v) => v ?? '').join(',')).join('\n')
}

function download(day: DayView, showActual: boolean) {
  const blob = new Blob([toCsv(day, showActual)], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `wind-${day.delivery_day}-decision-${day.cutoff.replace(':', '')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function HourTable({ day, showActual }: { day: DayView; showActual: boolean }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-slate-900">
        <span>
          Hour-by-hour table
          <span className="ms-2 text-sm font-normal text-slate-500 group-open:hidden">Show</span>
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            download(day, showActual)
          }}
          className="press flex items-center gap-1.5 rounded-lg ps-2.5 pe-3 py-1.5 text-sm font-normal text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <Download size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
          CSV
        </button>
      </summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-2 pe-4 font-medium">UK time</th>
              <th className="py-2 pe-4 font-medium">SP</th>
              <th className="py-2 pe-4 text-end font-medium">Forecast</th>
              <th className="py-2 pe-4 text-end font-medium">Expected</th>
              <th className="py-2 pe-4 text-end font-medium">80% range</th>
              <th className="py-2 pe-4 text-end font-medium">Change vs previous</th>
              {showActual && <th className="py-2 pe-4 text-end font-medium">Actual</th>}
              {showActual && <th className="py-2 pe-4 text-end font-medium">Error</th>}
            </tr>
          </thead>
          <tbody>
            {day.hours.map((h) => (
              <tr key={h.start_time} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pe-4">{h.local_time}</td>
                <td className="py-1.5 pe-4 text-slate-500">{h.settlement_period}</td>
                <td className="py-1.5 pe-4 text-end">{gw(h.forecast_mw)}</td>
                <td className="py-1.5 pe-4 text-end font-medium">{gw(h.adjusted_mw)}</td>
                <td className="py-1.5 pe-4 text-end text-slate-600">
                  {gw(h.band_low_mw)} – {gw(h.band_high_mw)}
                </td>
                <td className="py-1.5 pe-4 text-end text-slate-600">{signedGw(h.revision_mw)}</td>
                {showActual && <td className="py-1.5 pe-4 text-end">{gw(h.actual_mw)}</td>}
                {showActual && (
                  <td
                    className={`py-1.5 pe-4 text-end ${
                      (h.error_mw ?? 0) > 0 ? 'text-over' : 'text-sky-700'
                    }`}
                  >
                    {signedGw(h.error_mw)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
