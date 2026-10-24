import type { CSSProperties, ReactNode } from 'react'

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={title || action ? 'mt-4' : ''}>{children}</div>
    </section>
  )
}

export function Tile({
  label,
  value,
  detail,
  tone = 'default',
  style,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: 'default' | 'warn' | 'good'
  style?: CSSProperties
}) {
  const marker = {
    default: 'bg-slate-300',
    warn: 'bg-over',
    good: 'bg-good',
  }[tone]
  return (
    <div className="surface enter rounded-2xl p-4" style={style}>
      <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
        <span aria-hidden className={`size-1.5 rounded-full ${marker}`} />
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">{value}</div>
      {detail && <div className="mt-1 text-sm text-slate-600">{detail}</div>}
    </div>
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

/** Segmented control: outer radius 12px = inner 8px + 4px padding. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: ReactNode; title?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-slate-100 p-1">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`press rounded-lg px-3 py-1.5 text-sm font-medium ${
              selected
                ? 'bg-white text-slate-900 shadow-[var(--shadow-border)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
