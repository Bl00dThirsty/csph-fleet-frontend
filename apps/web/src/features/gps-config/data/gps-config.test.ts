import { describe, expect, it } from 'vitest'
import { displayNumber, getGpsConfigs, deviceStatusLabel } from './gps-config'
import type { Device, Organization, Vehicle } from '@lpg/types'

const orgs = [
  { id: 'org-1', name: 'Org Test', type: 'MARKETEUR', is_active: true },
] as Organization[]

const vehicles = [
  {
    id: 'veh-1',
    license_plate: 'CE-456',
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
    firmware_version: 'v1.2',
    battery_level: 90,
    battery_critical: false,
    assigned_to_vehicle_id: 'veh-1',
    org_id: 'org-1',
    last_sync: '2026-01-01',
    config_json: { update_interval_sec: 30, alert_speed_kmh: 90 },
    metadata_json: { imei: '12345', operator: 'MTN', model: 'X1' },
  },
  {
    id: 'gps-2',
    serial_number: 'GPS-002',
    device_type: 'GPS',
    status: 'OFFLINE',
    battery_level: 10,
    battery_critical: true,
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

describe('gps-config view-model', () => {
  it('only includes GPS devices', () => {
    const configs = getGpsConfigs(devices, vehicles, orgs)
    expect(configs.length).toBe(2)
    for (const config of configs) {
      expect(config.serialNumber).toMatch(/^GPS-/)
    }
  })

  it('resolves the assigned vehicle plate when present, with fallback otherwise', () => {
    const configs = getGpsConfigs(devices, vehicles, orgs)
    const byId = new Map(configs.map((c) => [c.id, c]))
    expect(byId.get('gps-1')?.vehiclePlate).toBe('CE-456')
    expect(byId.get('gps-1')?.updateIntervalSec).toBe(30)
    expect(byId.get('gps-1')?.imei).toBe('12345')
    expect(byId.get('gps-2')?.vehiclePlate).toBe('—')
    expect(displayNumber(byId.get('gps-2')?.geofenceRadiusM ?? null)).toBe('—')
  })

  it('labels statuses in French', () => {
    expect(deviceStatusLabel('DEPLOYED')).toBe('Déployé')
    expect(deviceStatusLabel('OFFLINE')).toBe('Hors ligne')
  })

  it('returns an empty list when no source rows are provided', () => {
    expect(getGpsConfigs()).toEqual([])
  })
})
