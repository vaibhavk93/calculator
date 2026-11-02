import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { bmiCategory, bodyMetrics } from './body'

// The coefficients are from the published papers (Mifflin 1990, Devine 1974, Deurenberg 1991, WHO BMI classes).
// They were NOT checked against an external calculator's output: expected numbers below are worked by hand.
// Man, 30 y, 175 cm, 70 kg: BMI 70/1.75^2 = 22.857; BMR 700 + 1093.75 - 150 + 5 = 1648.75;
// Devine 50 + 2.3 x (175/2.54 - 60) = 70.46; body fat 1.2 x 22.857 + 0.23 x 30 - 10.8 - 5.4 = 18.13.
const m = (h: string, w: string, a: string, s: 'male' | 'female' = 'male', act: Parameters<typeof bodyMetrics>[4] = 'sedentary') => bodyMetrics(new D(h), new D(w), new D(a), s, act)

describe('bodyMetrics', () => {
  it('man, 175 cm, 70 kg, 30 y', () => {
    const r = m('175', '70', '30')!
    expect(r.bmi.toDecimalPlaces(2).toFixed()).toBe('22.86')
    expect(r.category).toBe('Normal weight')
    expect(r.bmr.toFixed()).toBe('1648.75')
    expect(r.tdee.toDecimalPlaces(2).toFixed()).toBe('1978.5')
    expect(r.idealWeightKg.toDecimalPlaces(2).toFixed()).toBe('70.46')
    expect(r.bodyFatPercent.toDecimalPlaces(2).toFixed()).toBe('18.13')
    expect(r.healthyMinKg.toDecimalPlaces(1).toFixed()).toBe('56.7')
    expect(r.healthyMaxKg.toDecimalPlaces(1).toFixed()).toBe('76.3')
  })
  it('woman: lower BMR constant and Devine base, no sex term in body fat', () => {
    const r = m('160', '55', '28', 'female', 'moderate')!
    expect(r.bmr.toFixed()).toBe('1249')
    expect(r.tdee.toDecimalPlaces(2).toFixed()).toBe('1935.95')
    expect(r.idealWeightKg.toDecimalPlaces(2).toFixed()).toBe('52.38')
  })
  it('WHO class boundaries go to the higher class', () => {
    expect([bmiCategory(new D('18.49')), bmiCategory(new D('18.5')), bmiCategory(new D('24.99')), bmiCategory(new D('25')), bmiCategory(new D('30')), bmiCategory(new D('35')), bmiCategory(new D('40'))])
      .toEqual(['Underweight', 'Normal weight', 'Normal weight', 'Overweight', 'Obese class I', 'Obese class II', 'Obese class III'])
  })
  it('out-of-range input is null', () => {
    expect(m('0', '70', '30')).toBeNull()
    expect(m('175', '0', '30')).toBeNull()
    expect(m('175', '70', '17')).toBeNull()
    expect(m('175', '70', '121')).toBeNull()
  })
})
