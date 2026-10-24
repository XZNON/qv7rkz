import type { ReactNode } from 'react'

/** Full-width layout: controls in a sidebar, content in a fluid main column. */
export function Shell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:overscroll-contain lg:border-e lg:border-b-0">
        <div className="space-y-7 p-5">{sidebar}</div>
      </aside>
      <main className="min-w-0 space-y-4 p-4 sm:p-6">{children}</main>
    </div>
  )
}
