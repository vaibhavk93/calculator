import { describe, expect, it } from 'vitest'
import { DATE_LOCALE } from './dateLocale'

describe('dates are Indian first', () => {
  it('uses en-IN', () => expect(DATE_LOCALE).toBe('en-IN'))
})
