import { Info, Wind } from 'lucide-react'

import type { View } from '../lib/urlState'

const TABS: { view: View; label: string }[] = [
  { view: 'cockpit', label: 'Decision' },
  { view: 'scorecard', label: 'January scorecard' },
]

export function Header({
  view,
  onView,
  onAbout,
}: {
  view: View
  onView: (view: View) => void
  onAbout: () => void
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-forecast text-white">
            <Wind size={18} strokeWidth={2} absoluteStrokeWidth aria-hidden />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold">Day-ahead Wind Cockpit</div>
            <div className="text-xs text-slate-500">GB national wind · January 2026 pilot</div>
          </div>
        </div>

        <nav aria-label="Views" className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.view}
              type="button"
              aria-current={view === tab.view ? 'page' : undefined}
              onClick={() => onView(tab.view)}
              className={`press rounded-lg px-3 py-1.5 text-sm font-medium ${
                view === tab.view
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={onAbout}
          className="press ms-auto flex items-center gap-1.5 rounded-lg ps-2.5 pe-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <Info size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
          About the data
        </button>
      </div>
    </header>
  )
}
