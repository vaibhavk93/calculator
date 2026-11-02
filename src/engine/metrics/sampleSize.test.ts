import { describe, expect, it } from 'vitest'
import { normInv, sampleSize } from './sampleSize'

describe('normInv', () => {
  // Standard normal table values: z(97.5%) = 1.959964, z(80%) = 0.841621, z(90%) = 1.281552, z(99.5%) = 2.575829.
  it('matches known z values', () => {
    expect(normInv(0.975)).toBeCloseTo(1.959964, 5)
    expect(normInv(0.8)).toBeCloseTo(0.841621, 5)
    expect(normInv(0.9)).toBeCloseTo(1.281552, 5)
    expect(normInv(0.995)).toBeCloseTo(2.575829, 5)
  })
  it('is symmetric, zero at one half, and covers both tails', () => {
    expect(normInv(0.5)).toBeCloseTo(0, 9)
    expect(normInv(0.025)).toBeCloseTo(-1.959964, 5)
    expect(normInv(0.001)).toBeCloseTo(-3.090232, 5)
    expect(normInv(0.999)).toBeCloseTo(3.090232, 5)
  })
  it('is null outside 0..1', () => {
    expect(normInv(0)).toBeNull()
    expect(normInv(1)).toBeNull()
    expect(normInv(Number.NaN)).toBeNull()
  })
})

describe('sampleSize', () => {
  // Published figures, R documentation for stats::power.prop.test (stat.ethz.ch, "Examples"):
  //   power.prop.test(p1 = .50, p2 = .75, power = .90)  ->  n = 76.7 per group (alpha .05, two-sided)
  //   power.prop.test(p1 = 0.90, p2 = 1.0, power = 0.8) ->  n = 73.37 per group
  // Evan Miller's calculator page could not be used: its page text does not state alpha, power or MDE type for its example.
  it('matches the published R power.prop.test examples', () => {
    expect(Math.abs(sampleSize(0.5, 0.25, 'absolute', 0.05, 0.9)!.n - 76.7)).toBeLessThan(0.06)
    expect(Math.abs(sampleSize(0.9, 0.1, 'absolute', 0.05, 0.8)!.n - 73.37)).toBeLessThan(0.05)
  })
  // Independent recomputation by hand (not an external source): 20% -> 25%, 5% alpha, 80% power = 1093.9 -> 1,094 per variant.
  it('20% baseline, +5 points: about 1,094 per variant', () => {
    expect(Math.ceil(sampleSize(0.2, 0.05, 'absolute', 0.05, 0.8)!.n)).toBe(1094)
  })
  it('relative effect is the same as the matching absolute effect', () => {
    const rel = sampleSize(0.2, 0.25, 'relative', 0.05, 0.8)!
    expect(rel.p2).toBeCloseTo(0.25, 12)
    expect(rel.n).toBeCloseTo(sampleSize(0.2, 0.05, 'absolute', 0.05, 0.8)!.n, 6)
  })
  it('smaller effects and higher power need more visitors', () => {
    const base = sampleSize(0.2, 0.05, 'absolute', 0.05, 0.8)!.n
    expect(sampleSize(0.2, 0.025, 'absolute', 0.05, 0.8)!.n).toBeGreaterThan(base * 3)
    expect(sampleSize(0.2, 0.05, 'absolute', 0.05, 0.9)!.n).toBeGreaterThan(base)
  })
  it('nonsense is null, never NaN', () => {
    expect(sampleSize(0, 0.05, 'absolute', 0.05, 0.8)).toBeNull()
    expect(sampleSize(0.2, 0, 'absolute', 0.05, 0.8)).toBeNull()
    expect(sampleSize(0.2, -0.05, 'absolute', 0.05, 0.8)).toBeNull()
    expect(sampleSize(0.97, 0.05, 'absolute', 0.05, 0.8)).toBeNull()
    expect(sampleSize(0.2, 0.05, 'absolute', 0, 0.8)).toBeNull()
    expect(sampleSize(0.2, 0.05, 'absolute', 0.05, 1)).toBeNull()
  })
})
