import { describe, expect, it } from 'vitest'
import { CITIES, worldTimes, type CityTime } from './worldTime'

// Not checked against a live clock. Expected values come from the IANA tz database rules:
// India is UTC+5:30 all year; US clocks went back on Sun 1 Nov 2026 (so New York is UTC-5);
// Sydney is on daylight time (UTC+11) from the first Sunday of October.
const at = (iso: string, home = 'mumbai') => Object.fromEntries(worldTimes(new Date(iso), home)!.map((c) => [c.id, c])) as Record<string, CityTime>

describe('worldTimes', () => {
  const t = at('2026-11-02T00:00:00Z')
  it('India is 05:30 at 00:00 UTC, with a half-hour offset', () => {
    expect(t.mumbai).toMatchObject({ time: '05:30', offset: 'UTC+05:30', fromHome: 'same', day: 'Mon 2 Nov' })
  })
  it('other cities, including the day rolling back', () => {
    expect(t.tokyo).toMatchObject({ time: '09:00', fromHome: '+3h 30m' })
    expect(t.london).toMatchObject({ time: '00:00', offset: 'UTC+00:00', fromHome: '-5h 30m' })
    expect(t.newyork).toMatchObject({ time: '19:00', offset: 'UTC-05:00', day: 'Sun 1 Nov' })
    expect(t.sydney).toMatchObject({ time: '11:00', offset: 'UTC+11:00' })
    expect(t.kathmandu!.offset).toBe('UTC+05:45')
  })
  it('daylight saving moves a city: New York is UTC-4 in July', () => {
    expect(at('2026-07-01T00:00:00Z').newyork!.offset).toBe('UTC-04:00')
  })
  it('midnight reads 00:00, not 24:00', () => {
    expect(t.london!.time).toBe('00:00')
  })
  it('the home city changes the differences; an unknown home is null', () => {
    expect(at('2026-11-02T00:00:00Z', 'newyork').mumbai!.fromHome).toBe('+10h 30m')
    expect(worldTimes(new Date(), 'nowhere')).toBeNull()
    expect(CITIES.length).toBeGreaterThanOrEqual(20)
  })
})
