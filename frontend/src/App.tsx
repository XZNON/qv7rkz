import { useEffect, useState } from 'react'

type Health = { status: string }

export default function App() {
  const [health, setHealth] = useState<string>('checking…')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? (res.json() as Promise<Health>) : Promise.reject(res.status)))
      .then((body) => setHealth(body.status))
      .catch(() => setHealth('unreachable'))
  }, [])

  return (
    <main className="mx-auto max-w-3xl p-8 font-sans">
      <h1 className="text-2xl font-semibold">Wind Forecast Decision Cockpit</h1>
      <p className="mt-2 text-slate-600">API status: {health}</p>
    </main>
  )
}
