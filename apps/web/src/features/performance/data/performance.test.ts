import { describe, expect, it } from 'vitest'
import { getDriverPerformance, getPerformanceSummary } from './performance'
import type { Checkpoint, DeliveryTour, Driver } from '@lpg/types'

const drivers = [
  { id: 'driver-1', first_name: 'Samuel', last_name: 'Abanda' },
  { id: 'driver-2', first_name: 'Youssouf', last_name: 'Hamadou' },
] as Driver[]

const tours = [
  {
    id: 'tour-1',
    marketeur_org_id: 'org-1',
    execution_mode: 'INTERNAL',
    driver_id: 'driver-1',
    type: 'VRAC',
    status: 'CLOSED',
    requested_quantity: 10,
  },
  {
    id: 'tour-2',
    marketeur_org_id: 'org-1',
    execution_mode: 'INTERNAL',
    driver_id: 'driver-1',
    type: 'VRAC',
    status: 'INPROGRESS',
    requested_quantity: 10,
  },
  {
    id: 'tour-3',
    marketeur_org_id: 'org-1',
    execution_mode: 'INTERNAL',
    driver_id: 'driver-2',
    type: 'VRAC',
    status: 'CLOSED',
    requested_quantity: 10,
  },
] as DeliveryTour[]

const checkpoints = [
  { id: 'cp-1', tournee_id: 'tour-1', sequence: 1, status: 'COMPLETED' },
  { id: 'cp-2', tournee_id: 'tour-1', sequence: 2, status: 'SKIPPED' },
  { id: 'cp-3', tournee_id: 'tour-2', sequence: 1, status: 'PENDING' },
] as Checkpoint[]

describe('performance view-model', () => {
  it('computes per-driver completion with checkpoint joins', () => {
    const rows = getDriverPerformance(tours, checkpoints, drivers)
    expect(rows.length).toBe(2)
    const byId = new Map(rows.map((r) => [r.driverId, r]))
    expect(byId.get('driver-1')?.driverName).toBe('Samuel Abanda')
    expect(byId.get('driver-1')?.totalTours).toBe(2)
    expect(byId.get('driver-1')?.completed).toBe(1)
    expect(byId.get('driver-1')?.missedCheckpoints).toBe(1)
    expect(byId.get('driver-1')?.totalCheckpoints).toBe(3)
    for (const row of rows) {
      expect(row.driverName).toBeTruthy()
      expect(row.completionRate).toBeGreaterThanOrEqual(0)
      expect(row.completionRate).toBeLessThanOrEqual(100)
      expect(row.totalTours).toBe(row.completed + row.inFlight)
    }
  })

  it('derives summary completion rate', () => {
    const summary = getPerformanceSummary(tours, checkpoints, drivers)
    expect(summary.drivers).toBe(getDriverPerformance(tours, checkpoints, drivers).length)
    expect(summary.drivers).toBe(2)
    expect(summary.tours).toBe(3)
    expect(summary.avgCompletion).toBeGreaterThanOrEqual(0)
    expect(summary.missedCheckpoints).toBe(1)
  })

  it('returns an empty list when no source rows are provided', () => {
    expect(getDriverPerformance()).toEqual([])
  })
})
