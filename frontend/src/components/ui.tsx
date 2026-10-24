import type { CSSProperties, ReactNode } from 'react'

/** The one container for content: same radius, padding and header style everywhere. */
export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  style,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <section className={`surface rounded-2xl p-5 ${className}`} style={style}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export type StatItem = {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: 'default' | 'warn' | 'good'
}

/** A row of figures inside a card, separated by rules rather than separate surfaces. */
export function StatRow({ items, className = '' }: { items: StatItem[]; className?: string }) {
  const columns = items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-4 ${columns} ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 lg:border-s lg:border-slate-200 lg:ps-6 lg:first:border-s-0 lg:first:ps-0">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            {item.tone && item.tone !== 'default' && (
              <span aria-hidden className={`size-1.5 rounded-full ${item.tone === 'warn' ? 'bg-over' : 'bg-good'}`} />
            )}
            {item.label}
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{item.value}</dd>
          {item.detail && <dd className="mt-0.5 text-[13px] text-slate-500">{item.detail}</dd>}
        </div>
      ))}
    </dl>
  )
}

/** Labelled group inside the sidebar. */
export function SideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      {children}
    </section>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      Could not load data. {message}
    </div>
  )
}

export function Badge({
  tone,
  children,
}: {
  tone: 'good' | 'neutral' | 'warn'
  children: ReactNode
}) {
  const style = {
    good: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
    warn: 'bg-amber-50 text-amber-900 ring-amber-200',
  }[tone]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${style}`}
    >
      {children}
    </span>
  )
}

/** On/off switch. Track colour and knob position are both static cues; motion is optional. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="press flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm font-medium text-slate-800 hover:bg-slate-100"
    >
      {label}
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition-[background-color] duration-150 ${
          checked ? 'bg-slate-900' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm motion-safe:transition-[translate] motion-safe:duration-150 motion-safe:ease-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}
