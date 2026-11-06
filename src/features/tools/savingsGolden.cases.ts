import type { Values } from '../../lib/tool'

/** Saved-card inputs (no unit key) for the savings calculators: the default and two samples each. The fixture holds what the code gave BEFORE duration units. */
export const SAVINGS_CASES: Record<string, Values[]> = {
  sip: [{}, { monthly: '12000', rate: '9', years: '7' }, { monthly: '2500', rate: '0', years: '30' }],
  'step-up-sip': [{}, { years: '7', step: '5', rate: '9' }, { monthly: '1000', years: '1', step: '20' }],
  lumpsum: [{}, { amount: '250000', rate: '8', years: '3' }, { rate: '0', years: '25' }],
  'goal-sip': [{}, { target: '5000000', years: '15', existing: '200000', rate: '10' }, { existing: '2000000' }],
  swp: [{}, { wait: '5' }, { corpus: '5000000', withdraw: '20000', rate: '9', wait: '3', saveRate: '12' }, { withdraw: '1000' }],
  fd: [{}, { years: '1.5', principal: '250000', comp: 'monthly' }, { years: '0.25', rate: '6.5' }],
  rd: [{}, { years: '1.5' }, { years: '3', monthly: '2000', rate: '6.8' }],
  inflation: [{}, { years: '2.5', ret: '12' }, { amount: '5000', infl: '4', medical: '', years: '30' }],
  'cagr-xirr': [{}, { start: '5000', end: '9000', years: '3.5' }, { mode: 'xirr' }],
}
