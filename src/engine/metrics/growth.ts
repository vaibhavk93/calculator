import { D, type Dec } from '../decimal'

export interface Funnel {
  /** Step conversion % from the previous stage. null for the first stage and after an empty stage. */
  step: (Dec | null)[]
  /** % of the first stage still there at each stage. */
  overall: Dec[]
  /** Index of the stage with the lowest step conversion, or null. */
  worst: number | null
}

/** null when fewer than 2 stages or the first stage is empty. Counts are assumed non-increasing (checked by the caller). */
export function funnel(counts: Dec[]): Funnel | null {
  if (counts.length < 2 || counts[0]!.lte(0)) return null
  const step = counts.map((c, i) => (i === 0 || counts[i - 1]!.isZero() ? null : c.div(counts[i - 1]!).times(100)))
  const overall = counts.map((c) => c.div(counts[0]!).times(100))
  let worst: number | null = null
  step.forEach((s, i) => {
    if (s && (worst === null || s.lt(step[worst]!))) worst = i
  })
  return { step, overall, worst }
}

export interface RunRate {
  /** MRR at month 0..months. */
  mrr: Dec[]
  /** Net monthly change % = new + expansion - churn. */
  netPct: Dec
  /** Net revenue retention over 12 months %, from existing customers only: (1 + expansion - churn)^12. */
  nrr12: Dec
}

/**
 * Compounds MRR monthly. New = new-customer MRR as % of opening MRR; expansion = upsell from existing customers;
 * churn = lost MRR. Churn is capped at 100 by the caller. Months is a whole number.
 */
export function runRate(mrr: Dec, newPct: Dec, expansionPct: Dec, churnPct: Dec, months: number): RunRate {
  const netPct = newPct.plus(expansionPct).minus(churnPct)
  const factor = new D(1).plus(netPct.div(100))
  const out: Dec[] = [mrr]
  for (let i = 1; i <= months; i++) out.push(out[i - 1]!.times(factor))
  const nrr12 = new D(1).plus(expansionPct.minus(churnPct).div(100)).pow(12).times(100)
  return { mrr: out, netPct, nrr12 }
}

export interface Retention {
  /** % of the cohort retained at each period (same order as `retained`). */
  rates: Dec[]
  /** Periods an average customer stays inside the entered window: the start period (100%) plus every retention rate. */
  lifetime: Dec
}

/** null when the cohort is empty. */
export function retention(cohort: Dec, retained: Dec[]): Retention | null {
  if (cohort.lte(0)) return null
  const fractions = retained.map((r) => r.div(cohort))
  return {
    rates: fractions.map((f) => f.times(100)),
    lifetime: fractions.reduce((a, f) => a.plus(f), new D(1)),
  }
}
