import { describe, expect, it } from 'vitest'
import {
  filterToursByRange,
  formatRangeLabel,
  parseRangeSearch,
  presetRange,
  tourOverlapsRange,
} from './date-range'

const NOW = new Date('2026-04-28T12:00:00')

function tour(started_at: string | null, closed_at: string | null, created_at = '2026-01-05T08:00:00') {
  return { started_at, closed_at, created_at } as never
}

describe('presetRange', () => {
  it('computes trailing windows ending today', () => {
    expect(presetRange('7d', NOW)).toEqual({
      from: new Date('2026-04-22T00:00:00'),
      to: new Date('2026-04-28T00:00:00'),
    })
    expect(presetRange('30d', NOW).from).toEqual(new Date('2026-03-30T00:00:00'))
    expect(presetRange('90d', NOW).from).toEqual(new Date('2026-01-29T00:00:00'))
  })
})

describe('formatRangeLabel', () => {
  it('formats a French range label', () => {
    expect(formatRangeLabel(new Date('2026-04-01'), new Date('2026-04-28'))).toBe(
      '01 avr. – 28 avr. 2026',
    )
  })
})

describe('tourOverlapsRange', () => {
  const from = new Date('2026-04-01')
  const to = new Date('2026-04-30')

  it('keeps tours inside the range', () => {
    expect(tourOverlapsRange(tour('2026-04-10', '2026-04-12'), from, to)).toBe(true)
  })

  it('keeps open tours started before the range ends', () => {
    expect(tourOverlapsRange(tour('2026-04-20', null), from, to)).toBe(true)
    expect(tourOverlapsRange(tour('2026-05-02', null), from, to)).toBe(false)
  })

  it('falls back to created_at when started_at is missing', () => {
    expect(tourOverlapsRange(tour(null, null, '2026-04-05T08:00:00'), from, to)).toBe(true)
    expect(tourOverlapsRange(tour(null, null, '2026-02-01T08:00:00'), from, to)).toBe(true)
  })

  it('excludes tours fully outside the range', () => {
    expect(tourOverlapsRange(tour('2026-02-01', '2026-02-05'), from, to)).toBe(false)
    expect(tourOverlapsRange(tour('2026-05-01', '2026-05-03'), from, to)).toBe(false)
  })
})

describe('filterToursByRange', () => {
  it('returns all tours without a range and filters with one', () => {
    const tours = [
      tour('2026-04-10', '2026-04-12'),
      tour('2026-02-01', '2026-02-05'),
    ]
    expect(filterToursByRange(tours, null)).toHaveLength(2)
    expect(
      filterToursByRange(tours, { from: new Date('2026-04-01'), to: new Date('2026-04-30') }),
    ).toHaveLength(1)
  })
})

describe('parseRangeSearch', () => {
  it('parses ISO day params', () => {
    expect(parseRangeSearch({ from: '2026-04-01', to: '2026-04-28' })).toEqual({
      from: new Date('2026-04-01T00:00:00'),
      to: new Date('2026-04-28T00:00:00'),
    })
  })

  it('returns null for missing or invalid params', () => {
    expect(parseRangeSearch({})).toBeNull()
    expect(parseRangeSearch({ from: 'nope', to: '2026-04-28' })).toBeNull()
  })
})
