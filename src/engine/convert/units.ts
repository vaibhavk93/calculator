import { D, type Dec } from '../decimal'

export interface UnitDef {
  id: string
  label: string
  /** How many base units one of these is. A division like '1000/3600' is exact to 40 digits. */
  factor: string
}
export interface UnitCategory {
  id: string
  label: string
  /** Base unit is the one with factor 1. Temperature has no factors: see convertTemperature. */
  units: UnitDef[]
}

const f = (id: string, label: string, factor: string): UnitDef => ({ id, label, factor })

// Exact definitional factors. Source: NIST SP 811 (2008) Appendix B.8-B.9 and the international
// yard and pound agreement of 1959, which fixed 1 yd = 0.9144 m and 1 lb = 0.45359237 kg.
// Checked 2026-11-02. Indian land: cent = 1/100 acre. Bigha and gaj vary by state, so they are left out.
export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: 'length', label: 'Length',
    units: [f('mm', 'Millimetre', '0.001'), f('cm', 'Centimetre', '0.01'), f('m', 'Metre', '1'), f('km', 'Kilometre', '1000'),
      f('in', 'Inch', '0.0254'), f('ft', 'Foot', '0.3048'), f('yd', 'Yard', '0.9144'), f('mi', 'Mile', '1609.344'), f('nmi', 'Nautical mile', '1852')],
  },
  {
    id: 'mass', label: 'Mass',
    units: [f('mg', 'Milligram', '0.000001'), f('g', 'Gram', '0.001'), f('kg', 'Kilogram', '1'), f('t', 'Tonne', '1000'),
      f('oz', 'Ounce', '0.028349523125'), f('lb', 'Pound', '0.45359237'), f('st', 'Stone', '6.35029318')],
  },
  {
    id: 'volume', label: 'Volume',
    units: [f('ml', 'Millilitre', '0.001'), f('l', 'Litre', '1'), f('m3', 'Cubic metre', '1000'),
      f('tsp', 'Teaspoon (US)', '0.00492892159375'), f('tbsp', 'Tablespoon (US)', '0.01478676478125'),
      f('floz', 'Fluid ounce (US)', '0.0295735295625'), f('cup', 'Cup (US)', '0.2365882365'),
      f('galus', 'Gallon (US)', '3.785411784'), f('galuk', 'Gallon (UK)', '4.54609')],
  },
  {
    id: 'area', label: 'Area',
    units: [f('sqcm', 'Square centimetre', '0.0001'), f('sqm', 'Square metre', '1'), f('sqkm', 'Square kilometre', '1000000'),
      f('sqin', 'Square inch', '0.00064516'), f('sqft', 'Square foot', '0.09290304'), f('sqyd', 'Square yard', '0.83612736'),
      f('cent', 'Cent', '40.468564224'), f('acre', 'Acre', '4046.8564224'), f('ha', 'Hectare', '10000')],
  },
  {
    id: 'speed', label: 'Speed',
    units: [f('ms', 'Metre per second', '1'), f('kmh', 'Kilometre per hour', '1000/3600'), f('mph', 'Mile per hour', '0.44704'), f('kn', 'Knot', '1852/3600')],
  },
  {
    id: 'time', label: 'Time',
    units: [f('msec', 'Millisecond', '0.001'), f('s', 'Second', '1'), f('min', 'Minute', '60'), f('h', 'Hour', '3600'),
      f('d', 'Day', '86400'), f('wk', 'Week', '604800'), f('mo', 'Month (1/12 of a 365-day year)', '2628000'), f('yr', 'Year (365 days)', '31536000')],
  },
  {
    id: 'data', label: 'Data',
    units: [f('bit', 'Bit', '0.125'), f('B', 'Byte', '1'), f('KB', 'Kilobyte (1000 B)', '1000'), f('MB', 'Megabyte', '1000000'),
      f('GB', 'Gigabyte', '1000000000'), f('TB', 'Terabyte', '1000000000000'), f('KiB', 'Kibibyte (1024 B)', '1024'),
      f('MiB', 'Mebibyte', '1048576'), f('GiB', 'Gibibyte', '1073741824'), f('TiB', 'Tebibyte', '1099511627776')],
  },
  { id: 'temperature', label: 'Temperature', units: [f('C', 'Celsius', '1'), f('F', 'Fahrenheit', '1'), f('K', 'Kelvin', '1')] },
]

const factor = (u: UnitDef): Dec => {
  const [a, b] = u.factor.split('/')
  return b ? new D(a!).div(b) : new D(a!)
}

const toCelsius = (v: Dec, u: string): Dec => (u === 'F' ? v.minus(32).times(5).div(9) : u === 'K' ? v.minus('273.15') : v)
const fromCelsius = (c: Dec, u: string): Dec => (u === 'F' ? c.times(9).div(5).plus(32) : u === 'K' ? c.plus('273.15') : c)

/** Converts a value between two units of one category. Null for an unknown category or unit. */
export function convertUnit(category: string, from: string, to: string, value: Dec): Dec | null {
  const cat = UNIT_CATEGORIES.find((c) => c.id === category)
  const a = cat?.units.find((u) => u.id === from)
  const b = cat?.units.find((u) => u.id === to)
  if (!cat || !a || !b) return null
  if (category === 'temperature') return fromCelsius(toCelsius(value, from), to)
  return value.times(factor(a)).div(factor(b))
}

/** The same value in every unit of the category (the "sibling units" table). */
export function convertAll(category: string, from: string, value: Dec): { unit: UnitDef; value: Dec }[] {
  const cat = UNIT_CATEGORIES.find((c) => c.id === category)
  if (!cat) return []
  return cat.units.map((unit) => ({ unit, value: convertUnit(category, from, unit.id, value)! }))
}
