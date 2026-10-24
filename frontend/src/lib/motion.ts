import type { CSSProperties } from 'react'

/** Delay for the n-th item of a staged entrance (100ms apart). */
export const stagger = (n: number): CSSProperties => ({ animationDelay: `${n * 100}ms` })
