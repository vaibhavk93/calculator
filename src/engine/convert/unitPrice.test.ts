import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { unitPrices, type PriceUnit } from './unitPrice'

// Not externally verified (arithmetic). Rs 45 for 500 g is Rs 90/kg; Rs 85 for 1 kg is Rs 85/kg.
const r = (price: string, quantity: string, unit: PriceUnit) => ({ price: new D(price), quantity: new D(quantity), unit })

describe('unitPrices', () => {
  it('500 g vs 1 kg compare on the same footing', () => {
    const x = unitPrices([r('45', '500', 'g'), r('85', '1', 'kg')])!
    expect(x.perUnit.map((v) => v.toFixed())).toEqual(['90', '85'])
    expect(x.cheapest).toBe(1)
    expect(x.family).toBe('weight')
  })
  it('ml vs litre', () => {
    const x = unitPrices([r('30', '250', 'ml'), r('100', '1', 'l'), r('180', '2', 'l')])!
    expect(x.perUnit.map((v) => v.toFixed())).toEqual(['120', '100', '90'])
    expect(x.cheapest).toBe(2)
  })
  it('a tie picks the first', () => {
    expect(unitPrices([r('10', '1', 'pc'), r('20', '2', 'pc')])!.cheapest).toBe(0)
  })
  it('mixing weight and volume is null', () => {
    expect(unitPrices([r('45', '500', 'g'), r('85', '1', 'l')])).toBeNull()
  })
  it('zero quantity, negative price or no rows is null', () => {
    expect(unitPrices([r('45', '0', 'g'), r('85', '1', 'kg')])).toBeNull()
    expect(unitPrices([r('-1', '1', 'kg')])).toBeNull()
    expect(unitPrices([])).toBeNull()
  })
})
