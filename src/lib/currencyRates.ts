/**
 * Live currency rates, on top of the bundled snapshot in `engine/convert/currencySnapshot.ts`.
 *
 * The engine stays pure and offline (see architecture.test.ts: "the engine never touches the
 * browser"), so fetching and caching live rates lives here instead. The snapshot is always the
 * fallback: a blocked or failed fetch, a stale cache, or a first run with no network all just
 * leave `getCurrencyRates()` returning the bundled numbers, never an error the user sees.
 *
 * Only currencies already in the bundled snapshot are trusted from a response or a cache file.
 * That bounds what a malformed or hijacked payload could do to the app: at worst a currency is
 * missing (the convert fails with a plain "Pick two currencies"), never a new, unreviewed option
 * appearing in the list, and never a non-numeric value reaching the decimal engine.
 */
import { CURRENCY_SNAPSHOT } from '../engine/convert/currencySnapshot'

export interface RatesInfo {
  /** Same shape as CURRENCY_SNAPSHOT.perInr: how much of that currency 1 INR buys. */
  perInr: Record<string, string>
  /** The date the rates are for, as the source states it. */
  date: string
  source: string
  /** True once these came from a fetch (this run or a cached one), not the bundled snapshot. */
  live: boolean
}

const CACHE_KEY = 'vkcalc.currencyRates'
const STALE_MS = 6 * 60 * 60 * 1000
const ENDPOINT = 'https://api.frankfurter.dev/v1/latest?base=INR'
const LIVE_SOURCE = 'ECB reference rates via Frankfurter'
const KNOWN_CODES = Object.keys(CURRENCY_SNAPSHOT.perInr)

interface CacheShape {
  perInr: Record<string, string>
  date: string
  fetchedAt: number
}

let current: RatesInfo = {
  perInr: CURRENCY_SNAPSHOT.perInr,
  date: CURRENCY_SNAPSHOT.date,
  source: CURRENCY_SNAPSHOT.source,
  live: false,
}
let primed = false

const isPlainNumber = (v: unknown): v is string => typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)

/** Keeps only currencies we already know about, and only well-formed numbers. */
function sanitizePerInr(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const code of KNOWN_CODES) {
    const v = raw[code]
    if (isPlainNumber(v)) out[code] = v
  }
  return out
}

function readCache(raw: string | null): CacheShape | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Record<string, unknown>
    if (typeof d.date !== 'string' || typeof d.fetchedAt !== 'number' || typeof d.perInr !== 'object' || d.perInr === null) return null
    const perInr = sanitizePerInr(d.perInr as Record<string, unknown>)
    // Less than half the known currencies survived sanitising: treat the file as too damaged to trust.
    if (Object.keys(perInr).length < KNOWN_CODES.length / 2) return null
    return { perInr, date: d.date, fetchedAt: d.fetchedAt }
  } catch {
    return null
  }
}

function fromApiRates(rates: Record<string, unknown>): Record<string, string> {
  const numeric: Record<string, string> = { INR: '1' }
  for (const code of KNOWN_CODES) {
    const v = rates[code]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) numeric[code] = String(v)
  }
  return sanitizePerInr(numeric)
}

/** The best rates available right now, synchronously. Starts as the bundled snapshot. */
export function getCurrencyRates(): RatesInfo {
  return current
}

export interface RefreshDeps {
  now?: () => number
  fetchImpl?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

/**
 * Updates `current` from a cache file, then fetches fresh rates if the cache is missing or
 * older than 6 hours. Safe to call repeatedly or concurrently: a fetch only happens when the
 * cache actually is stale, and any failure leaves `current` exactly as it was.
 */
export async function refreshCurrencyRatesIfStale(deps: RefreshDeps = {}): Promise<void> {
  const now = deps.now ?? Date.now
  const fetchImpl = deps.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined)
  const storage = deps.storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)

  let cache: CacheShape | null = null
  try {
    cache = storage ? readCache(storage.getItem(CACHE_KEY)) : null
  } catch {
    cache = null
  }
  if (cache) current = { perInr: cache.perInr, date: cache.date, source: LIVE_SOURCE, live: true }

  const stale = cache === null || now() - cache.fetchedAt > STALE_MS
  if (!stale || !fetchImpl) return

  try {
    const res = await fetchImpl(ENDPOINT)
    if (!res.ok) return
    const body = (await res.json()) as { date?: unknown; rates?: unknown }
    if (typeof body.date !== 'string' || typeof body.rates !== 'object' || body.rates === null) return
    const perInr = fromApiRates(body.rates as Record<string, unknown>)
    if (Object.keys(perInr).length < KNOWN_CODES.length / 2) return
    const fetchedAt = now()
    current = { perInr, date: body.date, source: LIVE_SOURCE, live: true }
    try {
      storage?.setItem(CACHE_KEY, JSON.stringify({ perInr, date: body.date, fetchedAt }))
    } catch {
      // Storage full or blocked: the fetched rates still apply for the rest of this run.
    }
  } catch {
    // Offline, blocked, or a malformed response: keep the cache or the bundled snapshot.
  }
}

/** Starts the background refresh once per app run. Call from anywhere; later calls are no-ops. */
export function primeCurrencyRates(deps: RefreshDeps = {}): void {
  if (primed) return
  primed = true
  void refreshCurrencyRatesIfStale(deps)
}

/** Test-only: puts the module back to its just-loaded state. */
export function _resetCurrencyRatesForTest(): void {
  current = { perInr: CURRENCY_SNAPSHOT.perInr, date: CURRENCY_SNAPSHOT.date, source: CURRENCY_SNAPSHOT.source, live: false }
  primed = false
}
