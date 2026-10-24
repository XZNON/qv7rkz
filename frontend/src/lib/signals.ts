import type { SignalResult } from '../api/types'

/** One-line summary of a signal's January back-test. */
export function evidence(signal: SignalResult): string {
  if (signal.flagged_hours === 0) return 'Never fired in January.'
  if (signal.mae_ratio == null) return `Fired on ${signal.flagged_hours} hours.`
  return `Fired on ${signal.flagged_hours} January hours; typical miss was ${signal.mae_ratio.toFixed(1)}× the miss in other hours.`
}
