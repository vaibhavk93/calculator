import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { goldBill, type GoldBillInput } from './gold'
import { GOLD, GOLD_AS_OF } from './gstRates'

const base = (o: Partial<GoldBillInput> = {}): GoldBillInput => ({
  grams: new D('10'),
  karat: 22,
  rate24: new D('10000'),
  rateForPurity: null,
  making: { kind: 'percent', value: new D('12') },
  stones: new D('0'),
  interState: false,
  ...o,
})
const n = (x: { toString(): string } | null) => Number(x!.toString())

describe('gold jewellery bill', () => {
  it('holds the primary-source numbers: 3% = 1.5 + 1.5 (Schedule IV serial 10), 5% only on job work', () => {
    expect([GOLD.ratePct, GOLD.cgstPct, GOLD.sgstPct, GOLD.jobWorkPct]).toEqual(['3', '1.5', '1.5', '5'])
    expect(Date.parse(GOLD_AS_OF.asOf)).toBeLessThan(Date.parse(GOLD_AS_OF.until))
  })

  it("reproduces the GST Council FAQ Q7 example: Rs 28,000 gold + Rs 2,000 making = GST 900 (3% of 30,000)", () => {
    const b = goldBill(base({ grams: new D('4'), karat: 24, rate24: new D('7000'), making: { kind: 'flat', value: new D('2000') } }))!
    expect(n(b.metal)).toBe(28000)
    expect(n(b.making)).toBe(2000)
    expect(n(b.taxable)).toBe(30000)
    expect(n(b.gst)).toBe(900)
    expect(n(b.cgst)).toBe(450)
    expect(n(b.sgst)).toBe(450)
    expect(n(b.total)).toBe(30900)
  })

  it('GST is on gold + making + stones together, with the making charge shown separately or not', () => {
    const a = goldBill(base({ stones: new D('5000') }))!
    // 22K at 10,000 for 24K = 9,166.666.. a gram; 10 g = 91,666.67; making 12% = 11,000.00; stones 5,000.
    expect(n(a.ratePerGram.toDecimalPlaces(4))).toBe(9166.6667)
    expect(n(a.metal)).toBe(91666.67)
    expect(n(a.making)).toBe(11000)
    expect(n(a.taxable)).toBe(107666.67)
    expect(n(a.gst)).toBe(3230.0) // 3% of 1,07,666.67 = 3,230.0001 -> halves 1,615.00 each
    expect(n(a.total)).toBe(110896.67)
  })

  it('making can be a percent of the gold, a rate per gram, or a flat amount', () => {
    expect(n(goldBill(base({ making: { kind: 'percent', value: new D('10') } }))!.making)).toBe(9166.67)
    expect(n(goldBill(base({ making: { kind: 'perGram', value: new D('800') } }))!.making)).toBe(8000)
    expect(n(goldBill(base({ making: { kind: 'flat', value: new D('7500') } }))!.making)).toBe(7500)
  })

  it("the shop's own rate for the purity replaces rate x karat / 24", () => {
    const b = goldBill(base({ rateForPurity: new D('9100') }))!
    expect(n(b.ratePerGram)).toBe(9100)
    expect(n(b.metal)).toBe(91000)
  })

  it('other state: all IGST 3%', () => {
    const b = goldBill(base({ interState: true }))!
    expect(b.cgst).toBeNull()
    expect(b.sgst).toBeNull()
    expect(n(b.igst)).toBe(n(b.gst))
    expect(n(b.gst)).toBeCloseTo(n(b.taxable) * 0.03, 2)
  })

  it('"if billed 5% on making" is 2% of the making charge extra', () => {
    expect(n(goldBill(base({ making: { kind: 'flat', value: new D('2000') } }))!.extraIfFivePctOnMaking)).toBe(40)
    expect(n(goldBill(base({ making: { kind: 'flat', value: new D('0') } }))!.extraIfFivePctOnMaking)).toBe(0)
  })

  it('total is the sum of the printed lines, each to the paisa', () => {
    const b = goldBill(base({ grams: new D('3.337'), stones: new D('123.45') }))!
    expect(b.total.eq(b.metal.plus(b.making).plus(b.stones).plus(b.cgst!).plus(b.sgst!))).toBe(true)
    for (const x of [b.metal, b.making, b.cgst!, b.sgst!, b.total]) expect(x.decimalPlaces()).toBeLessThanOrEqual(2)
  })

  it('refuses input that is not a bill', () => {
    expect(goldBill(base({ grams: new D('0') }))).toBeNull()
    expect(goldBill(base({ karat: 21 }))).toBeNull()
    expect(goldBill(base({ rate24: new D('-1') }))).toBeNull()
    expect(goldBill(base({ stones: new D('-1') }))).toBeNull()
    expect(goldBill(base({ making: { kind: 'percent', value: new D('101') } }))).toBeNull()
    expect(goldBill(base({ making: { kind: 'flat', value: new D('-5') } }))).toBeNull()
  })
})
