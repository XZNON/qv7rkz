// One colour = one meaning across every view (Okabe-Ito, colour-blind safe).
// Colour is always paired with line style so it is never the only cue.
export const colors = {
  forecast: '#0072B2', // decision-time forecast: blue, dashed
  adjusted: '#0072B2', // bias-adjusted: blue, solid
  band: '#0072B2', // 80% range: light blue fill
  previous: '#9CA3AF', // previous run: thin grey
  actual: '#111827', // metered actual: black, solid
  over: '#D55E00', // over-forecast (buyer short): vermilion
  under: '#56B4E9', // under-forecast (buyer long): sky blue
  peak: '#0F172A', // evening peak window: neutral tint, labelled
  grid: '#E5E7EB',
  muted: '#6B7280',
} as const
