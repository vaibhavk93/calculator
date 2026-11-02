// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENCY_SNAPSHOT } from '../engine/convert/currencySnapshot'
import { _resetCurrencyRatesForTest, getCurrencyRates, primeCurrencyRates, refreshCurrencyRatesIfStale } from './currencyRates'

const CACHE_KEY = 'vkcalc.currencyRates'
const SIX_HOURS = 6 * 60 * 60 * 1000

// A realistic Frankfurter response covers nearly every currency we know. `overrides` lets a
// test change one or two values without having to restate the full set each time.
function apiResponse(overrides: Record<string, number> = {}, date = '2026-11-02') {
  const rates: Record<string, number> = {}
  for (const code of Object.keys(CURRENCY_SNAPSHOT.perInr)) {
    if (code === 'INR') continue
    rates[code] = Number(CURRENCY_SNAPSHOT.perInr[code])
  }
  Object.assign(rates, overrides)
  return { ok: true, json: async () => ({ date, rates }) } as Response
}

beforeEach(() => {
  localStorage.clear()
  _resetCurrencyRatesForTest()
})

describe('getCurrencyRates before anything runs', () => {
  it('starts as the bundled snapshot', () => {
    const r = getCurrencyRates()
    expect(r.live).toBe(false)
    expect(r.perInr).toEqual(CURRENCY_SNAPSHOT.perInr)
    expect(r.date).toBe(CURRENCY_SNAPSHOT.date)
  })
})

describe('refreshCurrencyRatesIfStale', () => {
  it('fetches when there is no cache, and the result becomes current', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(apiResponse({ USD: 0.0115, EUR: 0.0101 }))
    await refreshCurrencyRatesIfStale({ fetchImpl, now: () => 1000 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const r = getCurrencyRates()
    expect(r.live).toBe(true)
    expect(r.perInr.USD).toBe('0.0115')
    expect(r.perInr.INR).toBe('1')
    expect(r.date).toBe('2026-11-02')
  })

  it('writes a cache that a later call reads without fetching again', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(apiResponse({ USD: 0.012 }))
    await refreshCurrencyRatesIfStale({ fetchImpl, now: () => 1000 })
    _resetCurrencyRatesForTest()
    fetchImpl.mockClear()

    await refreshCurrencyRatesIfStale({ fetchImpl, now: () => 1000 + SIX_HOURS - 1 })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(getCurrencyRates().perInr.USD).toBe('0.012')
    expect(getCurrencyRates().live).toBe(true)
  })

  it('fetches again once the cache is older than 6 hours', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(apiResponse({ USD: 0.012 }))
    await refreshCurrencyRatesIfStale({ fetchImpl, now: () => 0 })
    fetchImpl.mockClear()
    fetchImpl.mockResolvedValue(apiResponse({ USD: 0.013 }, '2026-11-03'))

    await refreshCurrencyRatesIfStale({ fetchImpl, now: () => SIX_HOURS + 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(getCurrencyRates().perInr.USD).toBe('0.013')
    expect(getCurrencyRates().date).toBe('2026-11-03')
  })

  it('a failed fetch leaves the bundled snapshot in place, no throw', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(refreshCurrencyRatesIfStale({ fetchImpl, now: () => 0 })).resolves.toBeUndefined()
    expect(getCurrencyRates().live).toBe(false)
    expect(getCurrencyRates().perInr).toEqual(CURRENCY_SNAPSHOT.perInr)
  })

  it('a non-ok response is treated the same as a failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false } as Response)
    await refreshCurrencyRatesIfStale({ fetchImpl, now: () => 0 })
    expect(getCurrencyRates().live).toBe(false)
  })

  it('a malformed body (no rates, or rates is not an object) is ignored', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ date: '2026-11-02' }) } as Response)
    await refreshCurrencyRatesIfStale({ fetchImpl, now: () => 0 })
    expect(getCurrencyRates().live).toBe(false)
  })

  it('a stale cache is still used while the fetch is attempted', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(apiResponse({ USD: 0.012 }))
    await refreshCurrencyRatesIfStale({ fetchImpl, now: () => 0 })
    const freshFetch = vi.fn().mockRejectedValue(new Error('offline now'))
    await refreshCurrencyRatesIfStale({ fetchImpl: freshFetch, now: () => SIX_HOURS + 1 })
    // The stale cache was applied before the (failing) fetch attempt, so it is what remains.
    expect(getCurrencyRates().perInr.USD).toBe('0.012')
    expect(getCurrencyRates().live).toBe(true)
  })

  it('an unrecognised currency code from the API is dropped, not added to the list', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(apiResponse({ USD: 0.012, MARS_CREDIT: 999 }))
    await refreshCurrencyRatesIfStale({ fetchImpl, now: () => 0 })
    expect(getCurrencyRates().perInr).not.toHaveProperty('MARS_CREDIT')
  })

  it('a cache file tampered to mostly garbage is rejected, falling back to a fetch', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ date: '2020-01-01', fetchedAt: 0, perInr: { USD: 'DROP TABLE' } }))
    const fetchImpl = vi.fn().mockResolvedValue(apiResponse({ USD: 0.012 }))
    await refreshCurrencyRatesIfStale({ fetchImpl, now: () => 0 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(getCurrencyRates().perInr.USD).toBe('0.012')
  })

  it('no fetch implementation available (e.g. a very old WebView) does not throw', async () => {
    await expect(refreshCurrencyRatesIfStale({ fetchImpl: undefined, now: () => 0 })).resolves.toBeUndefined()
  })
})

describe('primeCurrencyRates', () => {
  it('only triggers a fetch once per run, however many times it is called', () => {
    const fetchImpl = vi.fn().mockResolvedValue(apiResponse({ USD: 0.012 }))
    primeCurrencyRates({ fetchImpl, now: () => 0 })
    primeCurrencyRates({ fetchImpl, now: () => 0 })
    primeCurrencyRates({ fetchImpl, now: () => 0 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
