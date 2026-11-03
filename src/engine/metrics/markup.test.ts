import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { fromMargin, fromMarkup, fromPrice } from './markup'

// External (textbook, recalled, not fetched): cost 80, price 100 -> profit 20, markup 25% of cost, margin 20% of price.
describe('markup and margin', () => {
  it('cost 80, price 100: markup 25%, margin 20%, profit 20', () => {
    const m = fromPrice(new D(80), new D(100))!
    expect(m.profit.toFixed()).toBe('20')
    expect(m.markupPct.toFixed()).toBe('25')
    expect(m.marginPct.toFixed()).toBe('20')
  })
  it('a 25% markup on 80 gives the same figures', () => {
    const m = fromMarkup(new D(80), new D(25))!
    expect(m.price.toFixed()).toBe('100')
    expect(m.marginPct.toFixed()).toBe('20')
  })
  it('a 20% margin on 80 gives the same figures', () => {
    const m = fromMargin(new D(80), new D(20))!
    expect(m.price.toFixed()).toBe('100')
    expect(m.markupPct.toFixed()).toBe('25')
  })
  // Second method: margin = markup / (1 + markup), for a 50% markup that is one third.
  it('50% markup is a 33.33% margin, never 50%', () => {
    expect(fromMarkup(new D(100), new D(50))!.marginPct.toDecimalPlaces(2).toFixed()).toBe('33.33')
  })
  it('a price below cost is a loss: negative profit, markup and margin', () => {
    const m = fromPrice(new D(100), new D(80))!
    expect(m.profit.toFixed()).toBe('-20')
    expect(m.markupPct.toFixed()).toBe('-20')
    expect(m.marginPct.toFixed()).toBe('-25')
  })
  it('impossible inputs are null', () => {
    expect(fromPrice(new D(0), new D(5))).toBeNull()
    expect(fromPrice(new D(5), new D(0))).toBeNull()
    expect(fromMargin(new D(5), new D(100))).toBeNull()
    expect(fromMarkup(new D(5), new D(-100))).toBeNull()
  })
})
