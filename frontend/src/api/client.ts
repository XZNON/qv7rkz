import { useEffect, useState } from 'react'

// The data are static, so each URL is fetched at most once per page load.
const cache = new Map<string, Promise<unknown>>()

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : response.statusText
    throw new Error(`${response.status}: ${detail}`)
  }
  return response.json() as Promise<T>
}

function cachedFetch<T>(url: string): Promise<T> {
  let request = cache.get(url)
  if (!request) {
    request = fetchJson<T>(url)
    request.catch(() => cache.delete(url)) // allow a retry after a failure
    cache.set(url, request)
  }
  return request as Promise<T>
}

export type ApiState<T> = {
  /** Data for the current URL, or the previous URL's data while the new one loads. */
  data?: T
  loading: boolean
  error?: string
}

/**
 * Fetch JSON for `url`. While a new URL loads, the previous data stay on screen
 * (marked loading) so switching days does not flash a skeleton.
 */
export function useApi<T>(url: string): ApiState<T> {
  const [state, setState] = useState<{ url?: string; data?: T; error?: string }>({})

  useEffect(() => {
    let cancelled = false
    cachedFetch<T>(url).then(
      (data) => !cancelled && setState({ url, data }),
      (err: Error) => !cancelled && setState((prev) => ({ ...prev, url, error: err.message })),
    )
    return () => {
      cancelled = true
    }
  }, [url])

  const current = state.url === url
  return {
    data: state.data,
    loading: !current,
    error: current ? state.error : undefined,
  }
}

export const api = {
  meta: () => '/api/meta',
  day: (date: string, cutoff: string) => `/api/day?date=${date}&cutoff=${cutoff}`,
  scorecard: (cutoff: string) => `/api/scorecard?cutoff=${cutoff}`,
  signals: (cutoff: string) => `/api/signals?cutoff=${cutoff}`,
}
