// Units: GW to one decimal for headlines and axes, MW with separators for detail.

const mwFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })

export const gw = (mw: number | null | undefined, digits = 1): string =>
  mw == null ? '–' : `${(mw / 1000).toFixed(digits)} GW`

export const mw = (value: number | null | undefined): string =>
  value == null ? '–' : `${mwFormat.format(value)} MW`

export const pct = (value: number | null | undefined, digits = 0): string =>
  value == null ? '–' : `${value.toFixed(digits)}%`

export const signedGw = (mw: number | null | undefined): string =>
  mw == null ? '–' : `${mw > 0 ? '+' : mw < 0 ? '−' : '±'}${Math.abs(mw / 1000).toFixed(1)} GW`

/** Error = forecast − actual, always also stated in words. */
export function errorInWords(errorMw: number | null | undefined): string {
  if (errorMw == null) return 'no actual yet'
  if (Math.abs(errorMw) < 50) return 'spot on'
  const size = gw(Math.abs(errorMw))
  return errorMw > 0 ? `over-forecast by ${size}` : `under-forecast by ${size}`
}

const ukTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
})
const ukDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

/** "07:30" in UK time. */
export const clock = (iso: string | null | undefined): string =>
  iso ? ukTime.format(new Date(iso)) : '–'

/** "Tue 27 Jan" in UK time. */
export const dayLabel = (iso: string): string => ukDay.format(new Date(iso))

const ukShortDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Calendar date "2026-01-28" as "28 Jan". */
export const shortDate = (day: string): string => ukShortDay.format(new Date(`${day}T12:00:00Z`))

/** Delivery day "2026-01-28" (a calendar date, no time zone) as "Wed 28 Jan". */
export const dateLabel = (day: string): string => ukDay.format(new Date(`${day}T12:00:00Z`))

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** "1 h 50 min" between two instants. */
export function duration(fromIso: string, toIso: string): string {
  const minutes = Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h ${m} min` : `${m} min`
}
