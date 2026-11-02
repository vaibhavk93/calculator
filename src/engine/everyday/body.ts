import { D, type Dec } from '../decimal'

export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive'

// Standard TDEE multipliers on BMR (Harris-Benedict activity factors, as used with Mifflin-St Jeor).
export const ACTIVITY_FACTOR: Record<Activity, string> = { sedentary: '1.2', light: '1.375', moderate: '1.55', active: '1.725', veryActive: '1.9' }

/** WHO adult BMI classes. Boundaries belong to the higher class (25.0 is overweight). */
export function bmiCategory(bmi: Dec): string {
  if (bmi.lt('18.5')) return 'Underweight'
  if (bmi.lt(25)) return 'Normal weight'
  if (bmi.lt(30)) return 'Overweight'
  if (bmi.lt(35)) return 'Obese class I'
  if (bmi.lt(40)) return 'Obese class II'
  return 'Obese class III'
}

export interface BodyMetrics { bmi: Dec; category: string; bmr: Dec; tdee: Dec; idealWeightKg: Dec; healthyMinKg: Dec; healthyMaxKg: Dec; bodyFatPercent: Dec }

/**
 * Adults only. Null if the height, weight or age is outside a sane range (height 50-272 cm, weight 2-500 kg, age 18-120).
 * BMI = kg / m^2.  BMR: Mifflin-St Jeor 1990 (10w + 6.25h - 5a + 5 for men, - 161 for women).
 * Ideal weight: Devine 1974 (50 kg men, 45.5 kg women, plus 2.3 kg per inch over 5 ft).
 * Body fat: Deurenberg 1991 (1.20 BMI + 0.23 age - 10.8 sex - 5.4, sex 1 = male, 0 = female).
 * Healthy range: weights giving BMI 18.5 to 24.9.
 */
export function bodyMetrics(heightCm: Dec, weightKg: Dec, age: Dec, sex: Sex, activity: Activity): BodyMetrics | null {
  if (heightCm.lt(50) || heightCm.gt(272) || weightKg.lt(2) || weightKg.gt(500) || age.lt(18) || age.gt(120)) return null
  const m = heightCm.div(100)
  const m2 = m.times(m)
  const bmi = weightKg.div(m2)
  const male = sex === 'male'
  const bmr = weightKg.times(10).plus(heightCm.times('6.25')).minus(age.times(5)).plus(male ? 5 : -161)
  const inchesOver5ft = heightCm.div('2.54').minus(60)
  const devine = new D(male ? 50 : '45.5').plus(inchesOver5ft.times('2.3'))
  return {
    bmi,
    category: bmiCategory(bmi),
    bmr,
    tdee: bmr.times(ACTIVITY_FACTOR[activity]),
    idealWeightKg: devine,
    healthyMinKg: m2.times('18.5'),
    healthyMaxKg: m2.times('24.9'),
    bodyFatPercent: bmi.times('1.2').plus(age.times('0.23')).minus(male ? '10.8' : 0).minus('5.4'),
  }
}
