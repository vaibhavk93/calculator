import { describe, expect, it } from 'vitest'
import { CITIES, instantAt, todayIn, worldTimes, type CityTime } from './worldTime'

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

describe('instantAt and todayIn', () => {
  it('3:00 pm in Mumbai is 4:30 am in New York in winter (UTC-5), and 5:30 am in summer (UTC-4)', () => {
    const w = instantAt('mumbai', '2026-12-10', '15:00')!
    expect(w.toISOString()).toBe('2026-12-10T09:30:00.000Z')
    expect(Object.fromEntries(worldTimes(w, 'mumbai')!.map((c) => [c.id, c])).newyork).toMatchObject({ time: '04:30', day: 'Thu 10 Dec' })
    const s = instantAt('mumbai', '2026-07-10', '15:00')!
    expect(Object.fromEntries(worldTimes(s, 'mumbai')!.map((c) => [c.id, c])).newyork!.time).toBe('05:30')
  })
  it('reads the time in the HOME city, not the device', () => {
    expect(instantAt('newyork', '2026-12-10', '15:00')!.toISOString()).toBe('2026-12-10T20:00:00.000Z')
    expect(instantAt('newyork', '2026-07-10', '15:00')!.toISOString()).toBe('2026-07-10T19:00:00.000Z')
  })
  it('a day can change between cities', () => {
    const w = instantAt('mumbai', '2026-12-10', '01:00')!
    expect(Object.fromEntries(worldTimes(w, 'mumbai')!.map((c) => [c.id, c])).newyork).toMatchObject({ time: '14:30', day: 'Wed 9 Dec' })
  })
  it('refuses a bad city, day or time', () => {
    expect(instantAt('nowhere', '2026-12-10', '15:00')).toBeNull()
    expect(instantAt('mumbai', '2026-02-31', '15:00')).toBeNull()
    expect(instantAt('mumbai', '2026-12-10', '25:00')).toBeNull()
    expect(instantAt('mumbai', '', '15:00')).toBeNull()
  })
  it('todayIn gives the date in that city', () => {
    expect(todayIn('mumbai', new Date('2026-11-02T20:00:00Z'))).toBe('2026-11-03')
    expect(todayIn('newyork', new Date('2026-11-02T20:00:00Z'))).toBe('2026-11-02')
    expect(todayIn('nowhere', new Date())).toBeNull()
  })
})
