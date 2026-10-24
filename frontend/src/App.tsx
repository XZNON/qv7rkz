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

      {meta.error && (
        <div className="p-6">
          <ErrorBox message={meta.error} />
        </div>
      )}
      {!meta.data && !meta.error && (
        <div className="p-6">
          <Skeleton className="h-96" />
        </div>
      )}
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

      <AboutDrawer open={aboutOpen} onClose={closeAbout} meta={meta.data} />
    </div>
  )
}
