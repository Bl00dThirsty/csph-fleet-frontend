import { describe, expect, it } from 'vitest'
import { formatFrDate, getPageNumbers } from './utils'

describe('getPageNumbers', () => {
  it('returns all pages when total is at most 5', () => {
    expect(getPageNumbers(1, 3)).toEqual([1, 2, 3])
    expect(getPageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('shows ellipsis near the beginning', () => {
    expect(getPageNumbers(1, 10)).toEqual([1, 2, 3, 4, '...', 10])
    expect(getPageNumbers(3, 10)).toEqual([1, 2, 3, 4, '...', 10])
  })

  it('shows ellipsis near the end', () => {
    expect(getPageNumbers(10, 10)).toEqual([1, '...', 7, 8, 9, 10])
    expect(getPageNumbers(9, 10)).toEqual([1, '...', 7, 8, 9, 10])
  })

  it('shows ellipsis on both side in the middle', () => {
    expect(getPageNumbers(5, 10)).toEqual([1, '...', 4, 5, 6, '...', 10])
  })

  it('handles current page greater than total pages', () => {
    expect(getPageNumbers(6, 5)).toEqual([1, 2, 3, 4, 5])
    expect(getPageNumbers(11, 10)).toEqual([1, '...', 7, 8, 9, 10])
  })
})

describe('formatFrDate', () => {
  it('formats ISO dates in French day-month-year', () => {
    expect(formatFrDate('2026-04-01')).toBe('01 avr. 2026')
    expect(formatFrDate('2026-04-01T15:30:00')).toBe('01 avr. 2026')
  })

  it('accepts Date instances', () => {
    expect(formatFrDate(new Date(2026, 3, 28))).toBe('28 avr. 2026')
  })

  it('renders a dash for missing or invalid dates', () => {
    expect(formatFrDate(null)).toBe('—')
    expect(formatFrDate(undefined)).toBe('—')
    expect(formatFrDate('')).toBe('—')
    expect(formatFrDate('not-a-date')).toBe('—')
  })
})
