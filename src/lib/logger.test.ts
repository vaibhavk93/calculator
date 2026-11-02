// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from './logger'

/**
 * The logger must never persist what you type. An earlier version wrote every
 * expression to localStorage on each key press, which broke the app's promise
 * that you control the record. These tests exist so that cannot come back.
 */
describe('logger', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('writes nothing to storage, at any level', () => {
    const logger = createLogger('Test')

    logger.debug('an expression', { expr: '2+2' })
    logger.info('an expression', { expr: '2+2' })
    logger.warn('an expression', { expr: '2+2' })
    logger.error('an expression', { expr: '2+2' })

    expect(localStorage.length).toBe(0)
  })

  it('does not call setItem even once', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    createLogger('Test').debug('2+2', { expr: '2+2' })

    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

})
