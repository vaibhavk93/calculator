import { describe, expect, it } from 'vitest'
import { D } from '../decimal'
import { tip } from './tip'

// Not externally verified (plain arithmetic). 2,400 x 10% = 240; 2,640 / 4 = 660.
const t = (b: string, p: string, n: string) => tip(new D(b), new D(p), new D(n))

describe('tip', () => {
  it('splits the total', () => {
    const r = t('2400', '10', '4')!
    expect([r.tip, r.total, r.perPerson].map((v) => v.toFixed())).toEqual(['240', '2640', '660'])
  })
  it('zero tip and one person', () => {
    expect(t('500', '0', '1')!.perPerson.toFixed()).toBe('500')
  })
  it('invalid: no people, half a person, negatives', () => {
    expect(t('500', '10', '0')).toBeNull()
    expect(t('500', '10', '2.5')).toBeNull()
    expect(t('-5', '10', '2')).toBeNull()
    expect(t('500', '-1', '2')).toBeNull()
  })
})
