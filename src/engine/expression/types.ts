import type { Dec } from '../decimal'

export type AngleMode = 'deg' | 'rad'

export type EvalErrorCode =
  | 'empty'
  | 'syntax'
  | 'div-zero'
  | 'domain'
  | 'overflow'
  | 'too-long'

export type EvalResult =
  | { ok: true; value: Dec }
  | { ok: false; code: EvalErrorCode; message: string }

/** Plain-language messages. Never "Invalid input", never "NaN". */
export const ERROR_MESSAGES: Record<EvalErrorCode, string> = {
  empty: '',
  syntax: 'Check the expression',
  'div-zero': "Can't divide by zero",
  domain: 'Not defined for this value',
  overflow: 'Too large to show',
  'too-long': 'Expression is too long',
}

export class ExprError extends Error {
  constructor(public readonly code: EvalErrorCode) {
    super(ERROR_MESSAGES[code])
  }
}

export interface EvalOptions {
  angle: AngleMode
}
