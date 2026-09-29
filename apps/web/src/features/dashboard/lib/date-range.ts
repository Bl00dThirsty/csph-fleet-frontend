import { endOfDay, format, startOfDay, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { DeliveryTour } from '@lpg/types'

export type DateRangePreset = '7d' | '30d' | '90d' | 'custom'

export type DateBounds = { from: Date; to: Date }

/** Trailing window ending today (day granularity, local time). */
export function presetRange(preset: Exclude<DateRangePreset, 'custom'>, now = new Date()): DateBounds {
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
  return { from: startOfDay(subDays(now, days - 1)), to: startOfDay(now) }
}

/** French range label, e.g. `01 avr. – 28 avr. 2026`. */
export function formatRangeLabel(from: Date, to: Date): string {
  return `${format(from, 'dd MMM', { locale: fr })} – ${format(to, 'dd MMM yyyy', { locale: fr })}`
}

type TourDates = Pick<DeliveryTour, 'started_at' | 'closed_at' | 'created_at'>

/** A tour overlaps when its [start, end] window intersects [from, end-of-day(to)]. */
export function tourOverlapsRange(tour: TourDates, from: Date, to: Date): boolean {
  const rawStart = tour.started_at ?? tour.created_at
  if (!rawStart) return false
  const start = new Date(rawStart).getTime()
  if (Number.isNaN(start)) return false
  const end = tour.closed_at ? new Date(tour.closed_at).getTime() : Number.POSITIVE_INFINITY
  if (Number.isNaN(end)) return false
  return start <= endOfDay(to).getTime() && end >= startOfDay(from).getTime()
}

export function filterToursByRange<T extends TourDates>(tours: readonly T[], range: DateBounds | null): T[] {
  if (!range) return [...tours]
  return tours.filter((t) => tourOverlapsRange(t, range.from, range.to))
}

/** Reads `?from=YYYY-MM-DD&to=YYYY-MM-DD` route search into day bounds. */
export function parseRangeSearch(search: Record<string, unknown>): DateBounds | null {
  const { from, to } = search as { from?: unknown; to?: unknown }
  if (typeof from !== 'string' || typeof to !== 'string') return null
  const fromDate = new Date(`${from}T00:00:00`)
  const toDate = new Date(`${to}T00:00:00`)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null
  return { from: fromDate, to: toDate }
}

/** Serializes day bounds back to `?from&?to` search params. */
export function serializeRangeSearch(range: DateBounds): { from: string; to: string } {
  const day = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: day(range.from), to: day(range.to) }
}
