import { describe, expect, it } from 'vitest'
import { buildDashboardView } from '@/features/dashboard/data/dashboard'
import { getTrucks } from '@/features/trucks/data/trucks'
import { getSites } from '@/features/sites/data/sites'
import { toTourActivities } from '@/features/tours/data/tour-activity'

describe('dashboard crash repro (empty inputs)', () => {
  it('buildDashboardView handles empty source', () => {
    expect(() =>
      buildDashboardView('SUPERADMIN', undefined, undefined, {
        routes: [],
        trucks: [],
        sites: [],
      }),
    ).not.toThrow()
  })

  it('getTrucks/getSites handle empty inputs', () => {
    expect(() => getTrucks([], [])).not.toThrow()
    expect(() => getSites([], {})).not.toThrow()
  })

  it('toTourActivities handles empty tours', () => {
    expect(() => toTourActivities([], { organizations: [] })).not.toThrow()
  })
})

describe('dashboard crash repro (api-shaped rows)', () => {
  it('getTrucks handles sparse vehicle rows with safe fallbacks', () => {
    const vehicles = [
      { id: 'v1', license_plate: 'CE-001', type: 'VRAC', org_id: 'org1' },
      { id: 'v2' },
    ] as never[]
    const rows = getTrucks(vehicles, [])
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ id: 'v2', license_plate: '', org_id: '' })
  })

  it('getSites handles sparse site rows with safe fallbacks', () => {
    const rows = [{ id: 's1', name: 'Site 1' }, {}] as never[]
    const views = getSites(rows, {})
    expect(views).toHaveLength(2)
    expect(views[1]).toMatchObject({ id: '', operator: '' })
  })
})
