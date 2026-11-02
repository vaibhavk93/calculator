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
