import type { Dec } from '../decimal'

export type PercentMode = 'of' | 'whatPercent' | 'change'

/** "X% of Y", "X is what % of Y", "% change from X to Y". Returns null where the answer is undefined (divide by zero). */
export function percentage(mode: PercentMode, x: Dec, y: Dec): Dec | null {
  switch (mode) {
    case 'of':
      return x.times(y).div(100)
    case 'whatPercent':
      return y.isZero() ? null : x.div(y).times(100)
    case 'change':
      return x.isZero() ? null : y.minus(x).div(x.abs()).times(100)
  }
}
