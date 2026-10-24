import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import type { Meta } from '../api/types'

const REPO_URL = 'https://github.com/XZNON/qv7rkz'

export function AboutDrawer({
  open,
  onClose,
  meta,
}: {
  open: boolean
  onClose: () => void
  meta?: Meta
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className={`fixed inset-0 z-30 ${open ? '' : 'pointer-events-none'}`} inert={!open}>
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/30 transition-opacity duration-300 ease-out ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className={`absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-xl transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-[opacity] ${
          open ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 motion-reduce:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="about-title" className="text-lg font-semibold">
            About the data
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={18} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5 text-sm leading-relaxed text-slate-700">
          <Section title="What this shows">
            For each delivery day in the pilot (2 Jan – 1 Feb 2026), the cockpit replays the
            national wind forecast your desk could actually have seen at the day-ahead decision
            time, shows how far to trust it, and afterwards scores it against metered wind.
          </Section>

          <Section title="Data">
            <ul className="space-y-2">
              {(meta?.datasets ?? []).map((d) => (
                <li key={d.name}>
                  <span className="font-medium text-slate-900">{d.name}</span>: {d.description}.{' '}
                  <span className="text-slate-500">{d.rows.toLocaleString('en-GB')} rows.</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-slate-500">
              Source: Elexon BMRS ({meta?.source}). Fetched once on{' '}
              {meta ? new Date(meta.data_fetched_at).toLocaleDateString('en-GB') : '…'} and stored
              with the app; January 2026 data do not change. No other data are used.
            </p>
          </Section>

          <Section title="Which forecast is shown">
            For every delivery hour, the forecast run with the latest publish time strictly before
            the decision time on the day before delivery. Runs published after the decision are
            never used, even if they are more accurate. The presets match the GB day-ahead auction
            gates: EPEX 60-minute (09:20), N2EX (09:50) and EPEX 30-minute (15:30). Forecasts are
            published about 8 times a day; the schedule is read from the data, not assumed.
          </Section>

          <Section title="How forecast and actual are compared">
            The forecast is hourly and the actual half-hourly, so each forecast hour is compared
            with the average of its two half-hours. Error = forecast − actual: a positive error is
            an over-forecast, which leaves a buyer who relied on it short. All times are UK time
            (GMT in January, the same as UTC).
          </Section>

          <Section title="Why the forecast runs high">
            The forecast sat about 1.7 GW above metered wind on average in January, and almost
            always above it when it predicted 15 GW or more. The gap appears in every month of
            2025 too, and even for hours already past when a run was published, so it is mostly a
            difference in what the two series measure rather than poor forecasting. The likely
            causes are curtailment (wind farms paid to switch off, which metered output reflects
            but the forecast does not) and differences in which farms each series covers. Neither
            Elexon nor NESO documents this, so treat it as the best available explanation.
          </Section>

          <Section title="How the expected line and 80% range are built">
            For each decision, the app looks at the 30 delivery days already settled before it
            (ending two days before delivery) at the same decision time, groups their hours by
            forecast level (below 5, 5–10, 10–15, 15+ GW), and takes the 10th, 50th and 90th
            percentile of the error in each group. The expected line removes the median error;
            the range spans the middle 80% of past errors. Nothing from the decision day or later
            is used.
          </Section>

          <Section title="Limits">
            One month is a small sample (forecast-evaluation guidance asks for at least 90 days),
            so results are indicative. Both series exclude wind farms connected to local
            distribution networks. The app has no price or demand data, so it shows wind cover
            and its uncertainty rather than how much to buy.
          </Section>

          <Section title="Source code">
            <a href={REPO_URL} className="text-forecast underline underline-offset-2" target="_blank" rel="noreferrer">
              {REPO_URL}
            </a>
          </Section>
        </div>
      </aside>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 font-semibold text-slate-900">{title}</h3>
      <div>{children}</div>
    </section>
  )
}
