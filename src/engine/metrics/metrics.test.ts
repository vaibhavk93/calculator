import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { burnBand, burnMultiple, cacLtv, cacPayback, ruleOf40 } from './unit'
import { funnel, retention, runRate } from './growth'

const d = (s: string) => new D(s)

// Not externally verified: these are the standard textbook definitions (CAC = spend / new customers,
// LTV = ARPU x margin / churn, payback = CAC / monthly gross profit). Checked by hand-worked numbers only.
describe('CAC and LTV', () => {
  it('worked example', () => {
    const r = cacLtv(d('600000'), d('300'), d('500'), d('70'), d('4'))!
    expect(r.cac.toFixed()).toBe('2000')
    expect(r.ltv!.toFixed()).toBe('8750')
    expect(r.lifetimeMonths!.toFixed()).toBe('25')
    expect(r.ratio!.toFixed()).toBe('4.375')
  })
  it('zero churn: LTV is undefined, never Infinity', () => {
    const r = cacLtv(d('600000'), d('300'), d('500'), d('70'), d('0'))!
    expect(r.cac.toFixed()).toBe('2000')
    expect(r.ltv).toBeNull()
    expect(r.ratio).toBeNull()
  })
  it('no new customers is null', () => {
    expect(cacLtv(d('1000'), d('0'), d('500'), d('70'), d('4'))).toBeNull()
  })
  it('zero spend gives CAC 0 and no ratio', () => {
    expect(cacLtv(d('0'), d('10'), d('500'), d('70'), d('4'))!.ratio).toBeNull()
  })
})

describe('CAC payback', () => {
  it('worked example, 2000 / (500 x 0.7) months', () => {
    expect(cacPayback(d('2000'), d('500'), d('70'))!.toDecimalPlaces(4).toFixed()).toBe('5.7143')
  })
  it('no gross profit is null', () => {
    expect(cacPayback(d('2000'), d('500'), d('0'))).toBeNull()
    expect(cacPayback(d('2000'), d('0'), d('70'))).toBeNull()
  })
})

describe('Rule of 40 and burn multiple', () => {
  it('score is growth plus margin, margin may be negative', () => {
    expect(ruleOf40(d('60'), d('-35')).toFixed()).toBe('25')
    expect(ruleOf40(d('30'), d('10')).toFixed()).toBe('40')
  })
  it('burn multiple is burn / net new ARR', () => {
    expect(burnMultiple(d('20000000'), d('15000000'))!.toDecimalPlaces(4).toFixed()).toBe('1.3333')
    expect(burnMultiple(d('0'), d('15000000'))!.toFixed()).toBe('0')
  })
  it('no net new ARR is null', () => {
    expect(burnMultiple(d('100'), d('0'))).toBeNull()
    expect(burnMultiple(d('100'), d('-5'))).toBeNull()
  })
  it('bands: below 1 great, 1-1.5 good, 1.5-2 okay, 2-3 weak, above 3 bad', () => {
    const b = (s: string) => burnBand(d(s))
    expect([b('0.99'), b('1'), b('1.49'), b('1.5'), b('1.99'), b('2'), b('3'), b('3.01')]).toEqual([
      'great', 'good', 'good', 'okay', 'okay', 'weak', 'weak', 'bad',
    ])
  })
})

describe('funnel', () => {
  it('step and overall conversion, biggest drop-off', () => {
    const f = funnel([d('1000'), d('500'), d('100')])!
    expect(f.step.map((s) => s?.toFixed() ?? null)).toEqual([null, '50', '20'])
    expect(f.overall.map((o) => o.toFixed())).toEqual(['100', '50', '10'])
    expect(f.worst).toBe(2)
  })
  it('an empty stage leaves later steps undefined, not NaN', () => {
    const f = funnel([d('100'), d('0'), d('0')])!
    expect(f.step.map((s) => s?.toFixed() ?? null)).toEqual([null, '0', null])
    expect(f.worst).toBe(1)
  })
  it('needs two stages and a non-empty start', () => {
    expect(funnel([d('5')])).toBeNull()
    expect(funnel([d('0'), d('0')])).toBeNull()
  })
})

describe('run-rate', () => {
  it('compounds the net monthly rate', () => {
    const r = runRate(d('100'), d('5'), d('1'), d('2'), 2)
    expect(r.netPct.toFixed()).toBe('4')
    expect(r.mrr.map((m) => m.toFixed())).toEqual(['100', '104', '108.16'])
  })
  // 0.98^12 = 0.78471... worked independently (not an external source)
  it('NRR over 12 months comes from expansion and churn only', () => {
    expect(runRate(d('100'), d('5'), d('1'), d('3'), 1).nrr12.toDecimalPlaces(2).toFixed()).toBe('78.47')
    expect(runRate(d('100'), d('0'), d('0'), d('0'), 1).nrr12.toFixed()).toBe('100')
  })
})

describe('retention', () => {
  it('rates and lifetime inside the window', () => {
    const r = retention(d('100'), [d('50'), d('25')])!
    expect(r.rates.map((x) => x.toFixed())).toEqual(['50', '25'])
    expect(r.lifetime.toFixed()).toBe('1.75')
  })
  it('empty cohort is null', () => {
    expect(retention(d('0'), [d('0')])).toBeNull()
  })
})
