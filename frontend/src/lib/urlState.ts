import { useCallback, useEffect, useState } from 'react'

// View state lives in the URL so every screen is a shareable link.
export type View = 'cockpit' | 'scorecard'

export type UrlState = {
  view: View
  date: string
  cutoff: string
  actual: boolean
}

export const DEFAULTS: UrlState = {
  view: 'cockpit',
  date: '2026-01-28',
  cutoff: '09:20',
  actual: false,
}

function read(): UrlState {
  const params = new URLSearchParams(window.location.search)
  const cutoff = params.get('cutoff')
  const date = params.get('date')
  return {
    view: params.get('view') === 'scorecard' ? 'scorecard' : 'cockpit',
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : DEFAULTS.date,
    cutoff: cutoff && /^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff) ? cutoff : DEFAULTS.cutoff,
    actual: params.get('actual') === '1',
  }
}

function write(state: UrlState, push: boolean) {
  const params = new URLSearchParams({
    view: state.view,
    date: state.date,
    cutoff: state.cutoff,
  })
  if (state.actual) params.set('actual', '1')
  const url = `${window.location.pathname}?${params}`
  if (push) window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
}

export function useUrlState(): [UrlState, (patch: Partial<UrlState>) => void] {
  const [state, setState] = useState<UrlState>(read)

  useEffect(() => {
    const onPop = () => setState(read())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const update = useCallback((patch: Partial<UrlState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      // New history entries for navigation (view/day); replace for small toggles.
      write(next, patch.view !== undefined || patch.date !== undefined)
      return next
    })
  }, [])

  return [state, update]
}
