import { useCallback, useState } from 'react'

import { api, useApi } from './api/client'
import type { Meta } from './api/types'
import { AboutDrawer } from './components/AboutDrawer'
import { Header } from './components/Header'
import { ErrorBox, Skeleton } from './components/ui'
import { useUrlState } from './lib/urlState'
import { Cockpit } from './views/Cockpit'
import { ScorecardView } from './views/Scorecard'

export default function App() {
  const [state, update] = useUrlState()
  const [aboutOpen, setAboutOpen] = useState(false)
  const closeAbout = useCallback(() => setAboutOpen(false), [])
  const meta = useApi<Meta>(api.meta())

  return (
    <div className="min-h-dvh">
      <Header view={state.view} onView={(view) => update({ view })} onAbout={() => setAboutOpen(true)} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {meta.error && <ErrorBox message={meta.error} />}
        {!meta.data && !meta.error && <Skeleton className="h-96" />}
        {meta.data &&
          (state.view === 'cockpit' ? (
            <Cockpit meta={meta.data} state={state} update={update} />
          ) : (
            <ScorecardView
              meta={meta.data}
              cutoff={state.cutoff}
              onCutoff={(cutoff) => update({ cutoff })}
              onOpenDay={(date) => update({ view: 'cockpit', date, actual: true })}
            />
          ))}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-500 sm:px-6">
        Data: Elexon BMRS (WINDFOR, FUELHH). Pilot built for a day-ahead purchasing team.
      </footer>

      <AboutDrawer open={aboutOpen} onClose={closeAbout} meta={meta.data} />
    </div>
  )
}
