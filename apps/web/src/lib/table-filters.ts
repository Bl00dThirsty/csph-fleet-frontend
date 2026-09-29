import type { Row } from '@tanstack/react-table'

/**
 * Canonical faceted filter: keeps the row when the cell value is one of the
 * selected values. Accepts arrays (faceted UI), scalars (URL-deserialized
 * single values) and empty values (no filtering). Every table column with a
 * faceted toolbar filter must use this — never a scalar `===`.
 */
export function arrIncludesCell<TData>(
  row: Row<TData>,
  columnId: string,
  filterValue: unknown,
): boolean {
  if (filterValue === undefined || filterValue === null) return true
  const raw = Array.isArray(filterValue) ? filterValue : [filterValue]
  const selected = raw.map((v) => String(v)).filter((v) => v !== '')
  if (selected.length === 0) return true
  return selected.includes(String(row.getValue(columnId)))
}

export type DateRangeBounds = {
  from?: string | Date
  to?: string | Date
}

function toDay(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim().slice(0, 10)
  }
  return ''
}

/**
 * URL codec for the `daterange` column-filter type: `{ from, to }` becomes
 * `?period=2026-04-01..2026-04-30` (open ends allowed). Used as the default
 * serialize/deserialize in `useTableUrlState` daterange configs.
 */
export function serializeDateRange(value: unknown): string | undefined {
  const v = (value ?? {}) as { from?: unknown; to?: unknown }
  const from = toDay(v.from)
  const to = toDay(v.to)
  if (!from && !to) return undefined
  return `${from}..${to}`
}

export function deserializeDateRange(raw: unknown): {
  from?: string
  to?: string
} {
  if (typeof raw !== 'string' || raw === '') return {}
  const [from, to] = raw.split('..')
  return {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }
}

/**
 * Adapts a column filter bound (Date or ISO string, as produced by the UI or
 * restored from the URL) into a Date for picker display. Date-only strings
 * parse as local midnight to avoid UTC day shifts.
 */
export function toDateOrUndefined(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const text = value.trim()
    const d = new Date(text.length <= 10 ? `${text}T00:00:00` : text)
    return Number.isNaN(d.getTime()) ? undefined : d
  }
  return undefined
}

/**
 * Normalizes a URL search value into the array shape faceted filters use.
 * TanStack Router parses `?status=A&status=B` as an array but a lone
 * `?status=A` as a string — without this, single values are dropped by
 * `type: 'array'` configs and multi values by `type: 'string'` configs.
 * Use as `deserialize` in `useTableUrlState` column filter configs.
 */
export function toFilterArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter((v) => v !== '')
  if (value === undefined || value === null) return []
  const single = String(value)
  return single === '' ? [] : [single]
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

function parseDateOnly(day: string, endOfDay: boolean): number | null {
  const m = DATE_ONLY.exec(day.trim())
  if (!m) return null
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  )
  const t = d.getTime()
  return Number.isNaN(t) ? null : t
}

function toTime(value: unknown, endOfDay = false): number | null {
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : t
  }
  if (typeof value === 'string' && value.trim() !== '') {
    if (DATE_ONLY.test(value.trim())) return parseDateOnly(value, endOfDay)
    const t = new Date(value).getTime()
    return Number.isNaN(t) ? null : t
  }
  return null
}

/**
 * Shared date-range filter for table columns holding ISO date strings (or
 * Dates). Inclusive on both ends; a date-only `to` bound means end of that
 * day. Rows with missing/invalid dates are excluded once a bound is set.
 */
export function dateInRange<TData>(
  row: Row<TData>,
  columnId: string,
  bounds: DateRangeBounds,
): boolean {
  const from = toTime(bounds?.from, false)
  const to = toTime(bounds?.to, true)
  if (from === null && to === null) return true
  const cell = toTime(row.getValue(columnId))
  if (cell === null) return false
  if (from !== null && cell < from) return false
  if (to !== null && cell > to) return false
  return true
}
