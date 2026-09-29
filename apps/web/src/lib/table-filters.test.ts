import { describe, expect, it } from 'vitest'
import {
  arrIncludesCell,
  dateInRange,
  deserializeDateRange,
  serializeDateRange,
  toDateOrUndefined,
  toFilterArray,
} from './table-filters'

// Minimal stand-in for a TanStack Row: only getValue is exercised.
function row(value: unknown) {
  return { getValue: (_id: string) => value } as never
}

describe('arrIncludesCell (canonical faceted filter)', () => {
  it('does not filter when the value is undefined, empty array or empty string', () => {
    expect(arrIncludesCell(row('PLANNED'), 'status', undefined)).toBe(true)
    expect(arrIncludesCell(row('PLANNED'), 'status', [])).toBe(true)
    expect(arrIncludesCell(row('PLANNED'), 'status', '')).toBe(true)
  })

  it('matches a single selected value', () => {
    expect(arrIncludesCell(row('PLANNED'), 'status', ['PLANNED'])).toBe(true)
    expect(arrIncludesCell(row('PLANNED'), 'status', ['CLOSED'])).toBe(false)
  })

  it('matches any of several selected values (multi-select)', () => {
    expect(
      arrIncludesCell(row('INPROGRESS'), 'status', ['PLANNED', 'INPROGRESS']),
    ).toBe(true)
    expect(arrIncludesCell(row('CLOSED'), 'status', ['PLANNED', 'INPROGRESS'])).toBe(
      false,
    )
  })

  it('tolerates a scalar filter value (URL-deserialized single)', () => {
    expect(arrIncludesCell(row('ADMIN'), 'role', 'ADMIN')).toBe(true)
    expect(arrIncludesCell(row('ADMIN'), 'role', 'AGENT')).toBe(false)
  })

  it('stringifies non-string cell values before comparing', () => {
    expect(arrIncludesCell(row(42), 'count', ['42'])).toBe(true)
    expect(arrIncludesCell(row(null), 'x', ['ACTIVE'])).toBe(false)
  })
})

describe('toFilterArray (URL round-trip normalizer)', () => {
  it('keeps arrays as-is', () => {
    expect(toFilterArray(['A', 'B'])).toEqual(['A', 'B'])
  })

  it('wraps a single URL string value', () => {
    expect(toFilterArray('ACTIVE')).toEqual(['ACTIVE'])
  })

  it('normalizes missing values to an empty array', () => {
    expect(toFilterArray(undefined)).toEqual([])
    expect(toFilterArray(null)).toEqual([])
    expect(toFilterArray('')).toEqual([])
  })

  it('round-trips through arrIncludesCell', () => {
    expect(arrIncludesCell(row('B'), 's', toFilterArray(['A', 'B']))).toBe(true)
    expect(arrIncludesCell(row('B'), 's', toFilterArray('B'))).toBe(true)
    expect(arrIncludesCell(row('B'), 's', toFilterArray(undefined))).toBe(true)
  })
})

describe('date-range URL codec (?period=from..to)', () => {
  it('serializes Date and string bounds to ISO days', () => {
    expect(
      serializeDateRange({ from: new Date('2026-04-01T10:00:00'), to: new Date('2026-04-30') }),
    ).toBe('2026-04-01..2026-04-30')
    expect(serializeDateRange({ from: '2026-04-01', to: undefined })).toBe('2026-04-01..')
    expect(serializeDateRange({})).toBeUndefined()
    expect(serializeDateRange(undefined)).toBeUndefined()
  })

  it('deserializes back to a bounds object', () => {
    expect(deserializeDateRange('2026-04-01..2026-04-30')).toEqual({
      from: '2026-04-01',
      to: '2026-04-30',
    })
    expect(deserializeDateRange('2026-04-01..')).toEqual({ from: '2026-04-01' })
    expect(deserializeDateRange('')).toEqual({})
    expect(deserializeDateRange(undefined)).toEqual({})
  })

  it('round-trips through dateInRange', () => {
    const restored = deserializeDateRange(
      serializeDateRange({ from: '2026-04-01', to: '2026-04-30' })!,
    )
    expect(dateInRange(row('2026-04-15'), 'd', restored)).toBe(true)
    expect(dateInRange(row('2026-05-01'), 'd', restored)).toBe(false)
  })
})

describe('toDateOrUndefined (filter UI adapter)', () => {
  it('passes valid Dates through', () => {
    const d = new Date('2026-04-15T10:00:00')
    expect(toDateOrUndefined(d)).toBe(d)
  })

  it('parses date-only strings as local midnight', () => {
    const d = toDateOrUndefined('2026-04-15')
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(3)
    expect(d?.getDate()).toBe(15)
    expect(d?.getHours()).toBe(0)
    expect(d?.getMinutes()).toBe(0)
  })

  it('parses full ISO strings as-is', () => {
    expect(toDateOrUndefined('2026-04-15T18:30:00')?.getHours()).toBe(18)
  })

  it('returns undefined for missing or invalid input', () => {
    expect(toDateOrUndefined(undefined)).toBeUndefined()
    expect(toDateOrUndefined(null)).toBeUndefined()
    expect(toDateOrUndefined('')).toBeUndefined()
    expect(toDateOrUndefined('not-a-date')).toBeUndefined()
    expect(toDateOrUndefined(new Date('invalid'))).toBeUndefined()
  })
})

describe('dateInRange (shared date-range filter)', () => {
  it('does not filter when both bounds are missing', () => {
    expect(
      dateInRange(row('2026-04-10'), 'created_at', { from: undefined, to: undefined }),
    ).toBe(true)
    expect(dateInRange(row('2026-04-10'), 'created_at', {})).toBe(true)
  })

  it('keeps rows inside [from, to] inclusive', () => {
    const range = { from: '2026-04-01', to: '2026-04-30' }
    expect(dateInRange(row('2026-04-01'), 'created_at', range)).toBe(true)
    expect(dateInRange(row('2026-04-15'), 'created_at', range)).toBe(true)
    expect(dateInRange(row('2026-04-30'), 'created_at', range)).toBe(true)
    expect(dateInRange(row('2026-03-31'), 'created_at', range)).toBe(false)
    expect(dateInRange(row('2026-05-01'), 'created_at', range)).toBe(false)
  })

  it('supports open-ended ranges', () => {
    expect(
      dateInRange(row('2026-09-01'), 'created_at', { from: '2026-04-01' }),
    ).toBe(true)
    expect(
      dateInRange(row('2026-01-01'), 'created_at', { to: '2026-04-30' }),
    ).toBe(true)
    expect(
      dateInRange(row('2026-01-01'), 'created_at', { from: '2026-04-01' }),
    ).toBe(false)
  })

  it('treats a date-only `to` bound as end of that day', () => {
    const range = { from: '2026-04-01', to: '2026-04-30' }
    expect(dateInRange(row('2026-04-30T18:00:00'), 'created_at', range)).toBe(true)
    expect(dateInRange(row('2026-05-01T00:00:00'), 'created_at', range)).toBe(false)
  })

  it('excludes rows with missing or invalid dates when a bound is set', () => {
    const range = { from: '2026-04-01', to: '2026-04-30' }
    expect(dateInRange(row(null), 'created_at', range)).toBe(false)
    expect(dateInRange(row('not-a-date'), 'created_at', range)).toBe(false)
  })

  it('accepts Date instances for bounds and cell values', () => {
    const range = { from: new Date('2026-04-01'), to: new Date('2026-04-30') }
    expect(dateInRange(row(new Date('2026-04-15')), 'created_at', range)).toBe(true)
    expect(dateInRange(row(new Date('2026-05-02')), 'created_at', range)).toBe(false)
  })
})
