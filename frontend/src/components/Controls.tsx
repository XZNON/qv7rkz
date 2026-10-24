import { ChevronLeft, ChevronRight } from 'lucide-react'

import type { Meta } from '../api/types'
import { addDays } from '../lib/format'
import { Segmented } from './ui'

const CUSTOM = 'custom'

export function Controls({
  meta,
  date,
  cutoff,
  onChange,
  showDate = true,
}: {
  meta: Meta
  date: string
  cutoff: string
  onChange: (patch: { date?: string; cutoff?: string }) => void
  showDate?: boolean
}) {
  const presetTimes = meta.presets.map((p) => p.time)
  const isPreset = presetTimes.includes(cutoff)
  const first = meta.first_delivery_day
  const last = meta.last_delivery_day

  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
      {showDate && (
        <div>
          <label htmlFor="delivery-day" className="block text-xs font-medium text-slate-500">
            Delivery day
          </label>
          <div className="mt-1.5 flex items-center gap-1">
            <StepButton
              label="Previous day"
              disabled={date <= first}
              onClick={() => onChange({ date: addDays(date, -1) })}
            >
              <ChevronLeft size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
            </StepButton>
            <input
              id="delivery-day"
              type="date"
              min={first}
              max={last}
              value={date}
              onChange={(e) => e.target.value && onChange({ date: e.target.value })}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm tabular-nums"
            />
            <StepButton
              label="Next day"
              disabled={date >= last}
              onClick={() => onChange({ date: addDays(date, 1) })}
            >
              <ChevronRight size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
            </StepButton>
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-medium text-slate-500">
          Decision time <span className="font-normal">(UK time, day before delivery)</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Segmented
            label="Decision time"
            value={isPreset ? cutoff : CUSTOM}
            onChange={(value) => onChange({ cutoff: value === CUSTOM ? cutoff : value })}
            options={[
              ...meta.presets.map((p) => ({
                value: p.time,
                title: `${p.label} gate closure`,
                label: (
                  <span className="flex flex-col items-start leading-tight sm:flex-row sm:items-baseline sm:gap-1.5">
                    <span className="tabular-nums">{p.time}</span>
                    <span className="text-xs font-normal text-slate-500">{p.label}</span>
                  </span>
                ),
              })),
              { value: CUSTOM, label: 'Custom' },
            ]}
          />
          {!isPreset && (
            <input
              type="time"
              aria-label="Custom decision time"
              value={cutoff}
              onChange={(e) => e.target.value && onChange({ cutoff: e.target.value })}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm tabular-nums"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="press grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
    >
      {children}
    </button>
  )
}
