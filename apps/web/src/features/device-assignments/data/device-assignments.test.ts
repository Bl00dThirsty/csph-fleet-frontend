import { describe, expect, it } from 'vitest'
import {
  getDeviceAssignments,
  deviceStatusLabel,
  deviceTypeLabel,
} from './device-assignments'
import type { AppUser, Device, Organization, Vehicle } from '@lpg/types'

const orgs = [
  { id: 'org-1', name: 'Org Test', type: 'MARKETEUR', is_active: true },
] as Organization[]

const users = [
  {
    id: 'user-1',
    email: 'jean@example.com',
    first_name: 'Jean',
    last_name: 'Dupont',
    system_role: 'LIVREUR',
    org_id: 'org-1',
    is_active: true,
  },
] as AppUser[]

const vehicles = [
  {
    id: 'veh-1',
    license_plate: 'CE-123',
    type: 'VRAC',
    org_id: 'org-1',
    is_active: true,
  },
] as Vehicle[]

const devices = [
  {
    id: 'dev-1',
    serial_number: 'GPS-001',
    device_type: 'GPS',
    status: 'ASSIGNED',
    battery_level: 80,
    battery_critical: false,
    assigned_to_user_id: 'user-1',
    org_id: 'org-1',
  },
  {
    id: 'dev-2',
    serial_number: 'PDA-001',
    device_type: 'PDA',
    status: 'INMISSION',
    battery_level: null,
    battery_critical: false,
    assigned_to_vehicle_id: 'veh-1',
    org_id: 'org-1',
  },
  {
    id: 'dev-3',
    serial_number: 'GPS-002',
    device_type: 'GPS',
    status: 'UNASSIGNED',
    battery_level: 50,
    battery_critical: false,
    org_id: 'org-1',
  },
] as Device[]

describe('device-assignments view-model', () => {
  it('only includes devices that are assigned', () => {
    const assignments = getDeviceAssignments(devices, users, vehicles, orgs)
    expect(assignments.length).toBe(2)
    expect(assignments.map((a) => a.id).sort()).toEqual(['dev-1', 'dev-2'])
  })

  it('classifies each assignment by target type and resolves joins', () => {
    const assignments = getDeviceAssignments(devices, users, vehicles, orgs)
    const byId = new Map(assignments.map((a) => [a.id, a]))
    expect(byId.get('dev-1')?.assignedType).toBe('USER')
    expect(byId.get('dev-1')?.assigneeName).toBe('Jean Dupont')
    expect(byId.get('dev-2')?.assignedType).toBe('VEHICLE')
    expect(byId.get('dev-2')?.assigneeName).toBe('CE-123')
    for (const assignment of assignments) {
      expect(assignment.orgName).toBe('Org Test')
    }
  })

  it('labels device types and statuses in French', () => {
    expect(deviceTypeLabel('GPS')).toBe('GPS')
    expect(deviceTypeLabel('RFIDREADER')).toBe('Lecteur RFID')
    expect(deviceStatusLabel('ASSIGNED')).toBe('Assigné')
    expect(deviceStatusLabel('DEPLOYED')).toBe('Déployé')
  })

  it('returns an empty list when no source rows are provided', () => {
    expect(getDeviceAssignments()).toEqual([])
  })
})
