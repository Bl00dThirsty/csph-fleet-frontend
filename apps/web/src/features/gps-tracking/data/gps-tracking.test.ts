import { describe, expect, it } from 'vitest'
import { getGpsTrackSummary, getGpsTracks } from './gps-tracking'
import type { Device, Organization, Vehicle } from '@lpg/types'

const organizations = [
  { id: 'org-1', name: 'Org Test', type: 'MARKETEUR', is_active: true },
] as Organization[]

const vehicles = [
  {
    id: 'veh-1',
    license_plate: 'CE-789',
    type: 'VRAC',
    org_id: 'org-1',
    is_active: true,
  },
] as Vehicle[]

const devices = [
  {
    id: 'gps-1',
    serial_number: 'GPS-001',
    device_type: 'GPS',
    status: 'DEPLOYED',
    battery_level: 90,
    battery_critical: false,
    last_known_position: [4.0511, 9.7679],
    assigned_to_vehicle_id: 'veh-1',
    org_id: 'org-1',
    last_sync: '2026-01-01',
  },
  {
    id: 'gps-2',
    serial_number: 'GPS-002',
    device_type: 'GPS',
    status: 'OFFLINE',
    battery_level: 10,
    battery_critical: true,
    last_known_position: null,
    org_id: 'org-1',
  },
  {
    id: 'pda-1',
    serial_number: 'PDA-001',
    device_type: 'PDA',
    status: 'ASSIGNED',
    battery_level: 50,
    battery_critical: false,
    org_id: 'org-1',
  },
] as unknown as Device[]

describe('gps-tracking view-model', () => {
  it('lists GPS devices with positions and resolves joins', () => {
    const tracks = getGpsTracks(devices, vehicles, organizations)
    expect(tracks.length).toBe(2)
    const byId = new Map(tracks.map((t) => [t.id, t]))
    expect(byId.get('gps-1')?.lat).toBe('4.0511')
    expect(byId.get('gps-1')?.vehiclePlate).toBe('CE-789')
    expect(byId.get('gps-1')?.orgName).toBe('Org Test')
    expect(byId.get('gps-2')?.lat).toBe('—')
    for (const track of tracks) {
      expect(track.serial).toBeTruthy()
      const located = track.position != null
      expect(located ? track.lat !== '—' : track.lat === '—').toBe(true)
    }
  })

  it('computes located vs unlocated summary', () => {
    const summary = getGpsTrackSummary(devices, vehicles, organizations)
    expect(summary.total).toBe(getGpsTracks(devices, vehicles, organizations).length)
    expect(summary.total).toBe(2)
    expect(summary.located).toBe(1)
    expect(summary.unlocated).toBe(1)
    expect(summary.located + summary.unlocated).toBe(summary.total)
  })

  it('returns an empty list when no source rows are provided', () => {
    expect(getGpsTracks()).toEqual([])
  })
})
