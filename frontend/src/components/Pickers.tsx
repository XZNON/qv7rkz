import { ChevronLeft, ChevronRight } from 'lucide-react'

import type { Meta } from '../api/types'
import { addDays } from '../lib/format'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Monday on or before `day`. */
function mondayOf(day: string): string {
  const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7
  return addDays(day, -weekday)
}

/** Month-style grid of the delivery days in scope. */
export function DayPicker({
  meta,
  value,
  onChange,
}: {
  meta: Meta
  value: string
  onChange: (day: string) => void
}) {
  const first = meta.first_delivery_day
  const last = meta.last_delivery_day
  const cells: string[] = []
  for (let d = mondayOf(first); d <= last || cells.length % 7; d = addDays(d, 1)) cells.push(d)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-900">January 2026</span>
        <div className="flex gap-0.5">
          <StepButton label="Previous day" disabled={value <= first} onClick={() => onChange(addDays(value, -1))}>
            <ChevronLeft size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
          </StepButton>
          <StepButton label="Next day" disabled={value >= last} onClick={() => onChange(addDays(value, 1))}>
            <ChevronRight size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
          </StepButton>
        </div>
      </div>
      <div role="grid" aria-label="Delivery day" className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={i} aria-hidden className="pb-1 text-[11px] font-medium text-slate-400">
            {w}
          </div>
        ))}
        {cells.map((day) => {
          const inScope = day >= first && day <= last
          const selected = day === value
          const label = Number(day.slice(8, 10))
          if (!inScope) {
            return (
              <div key={day} aria-hidden className="grid h-8 place-items-center text-xs text-slate-300 tabular-nums">
                {label}
              </div>
            )
          }
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              aria-label={day}
              onClick={() => onChange(day)}
              className={`press h-8 rounded-lg text-[13px] tabular-nums ${
                selected ? 'bg-slate-900 font-semibold text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {day.endsWith('-01') && day > first ? `${label} Feb` : label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const CUSTOM = 'custom'

/** Decision-time presets as a vertical radio list, plus a custom time. */
export function CutoffPicker({
  meta,
  value,
  onChange,
}: {
  meta: Meta
  value: string
  onChange: (cutoff: string) => void
}) {
  const isPreset = meta.presets.some((p) => p.time === value)
  const options = [
    ...meta.presets.map((p) => ({ key: p.time, time: p.time, label: p.label })),
    { key: CUSTOM, time: 'Custom', label: 'Any time on the day before' },
  ]
  return (
    <div role="radiogroup" aria-label="Decision time" className="space-y-0.5">
      {options.map((option) => {
        const selected = option.key === CUSTOM ? !isPreset : option.key === value
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (option.key !== CUSTOM) onChange(option.key)
              else if (isPreset) onChange('12:00') // any non-preset time reveals the input
            }}
            className={`press flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start ${
              selected ? 'bg-slate-100' : 'hover:bg-slate-50'
            }`}
          >
            <span
              aria-hidden
              className={`grid size-4 shrink-0 place-items-center rounded-full border ${
                selected ? 'border-forecast' : 'border-input'
              }`}
            >
              {selected && <span className="size-2 rounded-full bg-forecast" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900 tabular-nums">{option.time}</span>
              <span className="block text-xs text-slate-500">{option.label}</span>
            </span>
          </button>
        )
      })}
      {!isPreset && (
        <input
          type="time"
          aria-label="Custom decision time"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="mt-2 ms-10 h-9 rounded-lg border border-input bg-white px-2.5 text-sm tabular-nums"
        />
      )}
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
      className="press grid size-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
    >
      {children}
    </button>
  )
}
