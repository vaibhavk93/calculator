import { describe, expect, it } from 'vitest'
import { isPerson, planDrain, type InboxItem } from './inbox'
import { buildCandidates, parseSms } from './smsParse'
import { starterBudget } from './budget'

/** SYNTHETIC messages (made-up names and numbers): the payee in the "sent via UPI ... to NAME handle" family, and the person flag. */
const BODY = 'Rs 150.00 sent via UPI from ICICI Bank A/c *9087 to RAHUL SHARMA rahul.s@okaxis on 05-11-26. UPI Ref 631245987012. Not you? Call 18002662'

describe('payee of "sent via UPI from <bank> A/c ... to NAME handle"', () => {
  it('takes the name before the handle, and the bank fallback stays only when no payee can be read', () => {
    const p = parseSms(BODY, 'VM-ICICIB')
    expect(p).toMatchObject({ ok: true, merchant: 'Rahul Sharma', last4: '9087', mode: 'upi' })
    const nameless = parseSms('Rs 150.00 sent via UPI from ICICI Bank A/c *9087 on 05-11-26. UPI Ref 631245987013', 'VM-ICICIB')
    expect(nameless).toMatchObject({ ok: true, merchant: '' })
  })
  it('a UPI payee that looks like a person is flagged as a person; a known business is not', () => {
    expect(isPerson('upi', 'Rahul Sharma', BODY)).toBe(true)
    expect(isPerson('upi', 'Swiggy', 'Rs 150 sent via UPI to Swiggy swiggy@ybl')).toBe(false)
    expect(isPerson('upi', 'Asha Devi', 'UPI/P2A/312345678900/ASHA DEVI')).toBe(true)
    expect(isPerson('upi', 'Sharma Stores', 'to SHARMA STORES shop@ybl')).toBe(false)
  })
  it('the Inbox item carries the name and the person flag, and is never auto-added', () => {
    const plan = planDrain([{ id: 'm1', sender: 'VM-ICICIB', body: BODY, receivedAt: new Date('2026-11-05T10:00:00+05:30').getTime() }], starterBudget(), { auto: true, now: 1, newId: () => 'e1' })
    const item = plan.items[0] as InboxItem
    expect(item).toMatchObject({ merchant: 'Rahul Sharma', person: true, status: 'pending' })
    expect(plan.entries).toEqual([])
  })
  it('the manual scan lists it under the name', () => {
    const r = buildCandidates([{ id: '1', address: 'VM-ICICIB', date: new Date(2026, 10, 5, 12).getTime(), body: BODY }], starterBudget(), () => null)
    expect(r.found[0]).toMatchObject({ merchant: 'Rahul Sharma', nature: 'spend', mergedFrom: 1 })
  })
})
