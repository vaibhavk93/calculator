import { afterEach, describe, expect, it } from 'vitest'
import { backDepth, goBack, pushBack } from './backStack'

const calls: string[] = []
const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach((c) => c())
  calls.length = 0
})
const add = (name: string) => cleanups.push(pushBack(() => calls.push(name)))

describe('backStack', () => {
  it('runs the newest handler first', () => {
    add('list')
    add('tool')
    expect(goBack()).toBe(true)
    expect(calls).toEqual(['tool'])
  })
  it('a removed handler no longer runs, and the one below it does', () => {
    add('list')
    const off = pushBack(() => calls.push('tool'))
    off()
    goBack()
    expect(calls).toEqual(['list'])
  })
  it('with nothing registered it reports false so the caller can decide', () => {
    expect(backDepth()).toBe(0)
    expect(goBack()).toBe(false)
  })
  it('removing twice is harmless', () => {
    const off = pushBack(() => calls.push('x'))
    off()
    off()
    expect(backDepth()).toBe(0)
  })
})
