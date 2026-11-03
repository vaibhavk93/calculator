/** Cities offered, with IANA time zone names (the tz database, which knows daylight saving). */
export const CITIES: { id: string; label: string; zone: string }[] = [
  { id: 'mumbai', label: 'Mumbai / Kolkata (India)', zone: 'Asia/Kolkata' },
  { id: 'dubai', label: 'Dubai', zone: 'Asia/Dubai' },
  { id: 'karachi', label: 'Karachi', zone: 'Asia/Karachi' },
  { id: 'dhaka', label: 'Dhaka', zone: 'Asia/Dhaka' },
  { id: 'kathmandu', label: 'Kathmandu', zone: 'Asia/Kathmandu' },
  { id: 'colombo', label: 'Colombo', zone: 'Asia/Colombo' },
  { id: 'bangkok', label: 'Bangkok', zone: 'Asia/Bangkok' },
  { id: 'singapore', label: 'Singapore', zone: 'Asia/Singapore' },
  { id: 'hongkong', label: 'Hong Kong', zone: 'Asia/Hong_Kong' },
  { id: 'tokyo', label: 'Tokyo', zone: 'Asia/Tokyo' },
  { id: 'seoul', label: 'Seoul', zone: 'Asia/Seoul' },
  { id: 'sydney', label: 'Sydney', zone: 'Australia/Sydney' },
  { id: 'auckland', label: 'Auckland', zone: 'Pacific/Auckland' },
  { id: 'moscow', label: 'Moscow', zone: 'Europe/Moscow' },
  { id: 'istanbul', label: 'Istanbul', zone: 'Europe/Istanbul' },
  { id: 'cairo', label: 'Cairo', zone: 'Africa/Cairo' },
  { id: 'paris', label: 'Paris / Berlin', zone: 'Europe/Paris' },
  { id: 'london', label: 'London', zone: 'Europe/London' },
  { id: 'saopaulo', label: 'Sao Paulo', zone: 'America/Sao_Paulo' },
  { id: 'newyork', label: 'New York', zone: 'America/New_York' },
  { id: 'chicago', label: 'Chicago', zone: 'America/Chicago' },
  { id: 'denver', label: 'Denver', zone: 'America/Denver' },
  { id: 'losangeles', label: 'Los Angeles', zone: 'America/Los_Angeles' },
]

/** Minutes east of UTC for a zone at an instant, from Intl's "GMT+05:30" style name. */
function offsetMinutes(now: Date, zone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name)
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0
}

const offsetText = (min: number): string => `UTC${min < 0 ? '-' : '+'}${String(Math.floor(Math.abs(min) / 60)).padStart(2, '0')}:${String(Math.abs(min) % 60).padStart(2, '0')}`

export interface CityTime { id: string; label: string; time: string; day: string; offset: string; fromHome: string }

/** "Hours ahead/behind" text such as "+5h 30m", "-12h", or "same". */
const diffText = (min: number): string => (min === 0 ? 'same' : `${min < 0 ? '-' : '+'}${Math.floor(Math.abs(min) / 60)}h${Math.abs(min) % 60 ? ` ${Math.abs(min) % 60}m` : ''}`)

/** The time in every city at the instant `now`, with each one's offset and difference from the home city. */
export function worldTimes(now: Date, homeId: string): CityTime[] | null {
  const home = CITIES.find((c) => c.id === homeId)
  if (!home) return null
  const homeOff = offsetMinutes(now, home.zone)
  return CITIES.map((c) => {
    const off = offsetMinutes(now, c.zone)
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: c.zone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(now)
    const p = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
    return { id: c.id, label: c.label, time: `${p('hour')}:${p('minute')}`, day: `${p('weekday')} ${p('day')} ${p('month')}`, offset: offsetText(off), fromHome: diffText(off - homeOff) }
  })
}

/** Today's date in a city, "YYYY-MM-DD". Null for an unknown city. */
export function todayIn(homeId: string, now: Date): string | null {
  const home = CITIES.find((c) => c.id === homeId)
  if (!home) return null
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: home.zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
  return `${p('year')}-${p('month')}-${p('day')}`
}

/**
 * The moment the clock in a city reads `day` ("YYYY-MM-DD") at `time` ("HH:MM", 24 hour), or null if the city, the day
 * or the time is not valid. The city's offset is looked up for THAT day, so daylight saving is right. A clock time that
 * does not exist (the hour skipped when clocks go forward) is read with the offset from before the change.
 */
export function instantAt(homeId: string, day: string, time: string): Date | null {
  const home = CITIES.find((c) => c.id === homeId)
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!home || !d || !t) return null
  const [y, mo, da] = [Number(d[1]), Number(d[2]), Number(d[3])]
  const wall = Date.UTC(y, mo - 1, da, Number(t[1]), Number(t[2]))
  if (new Date(wall).getUTCDate() !== da || new Date(wall).getUTCMonth() !== mo - 1) return null // 31 Feb and the like
  const first = wall - offsetMinutes(new Date(wall), home.zone) * 60_000
  const second = wall - offsetMinutes(new Date(first), home.zone) * 60_000
  return new Date(second)
}
