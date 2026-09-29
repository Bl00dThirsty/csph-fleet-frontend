import { describe, expect, it } from 'vitest'
import { toTourActivities } from './tour-activity'

const baseTour = {
  id: 'tour-empty',
  status: 'INPROGRESS',
  type: 'VRAC',
  execution_mode: 'INTERNAL',
  marketeur_org_id: 'org1',
  vehicle_id: null,
  driver_id: null,
  requested_quantity: 10,
  loaded_quantity: null,
  delivered_quantity: null,
  started_at: null,
  closed_at: null,
  created_at: '2026-09-01T08:00:00Z',
  updated_at: '2026-09-01T08:00:00Z',
  deleted_at: null,
  created_by: 'system',
  updated_by: 'system',
}

describe('tour-activity join robustness (denied/empty backend rows)', () => {
  it('vehicle-less tour with empty vehicle rows yields a defined placeholder truck', () => {
    const views = toTourActivities([baseTour] as never, {
      vehicles: [],
      organizations: [],
      checkpoints: [],
      anomalies: [],
      clientSites: [],
      scanEvents: [],
    })
    expect(views).toHaveLength(1)
    expect(views[0]!.truck).toBeDefined()
    expect(views[0]!.truck.license_plate).toBe('—')
    expect(views[0]!.truck.tenant_name).toBe('—')
  })

  it('tour with a matching live vehicle resolves the live truck join', () => {
    const tour = { ...baseTour, id: 'tour-live', vehicle_id: 'v1' }
    const views = toTourActivities([tour] as never, {
      vehicles: [
        { id: 'v1', license_plate: 'CE-001-A', type: 'VRAC', org_id: 'org1', is_active: true },
      ] as never,
      organizations: [{ id: 'org1', name: 'SCTM', is_active: true }] as never,
      checkpoints: [],
      anomalies: [],
      clientSites: [],
      scanEvents: [],
    })
    expect(views).toHaveLength(1)
    expect(views[0]!.truck.license_plate).toBe('CE-001-A')
    expect(views[0]!.truck.tenant_name).toBe('SCTM')
  })
})
