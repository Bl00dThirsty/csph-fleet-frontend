import {
  devices as defaultDevices,
  organizations as defaultOrganizations,
  vehicles as defaultVehicles,
} from '@/lib/entity-data'
import type { Device, Organization, Vehicle } from '@lpg/types'

export interface GpsTrackView {
  id: string
  serial: string
  position: [number, number] | null
  vehiclePlate: string
  orgName: string
  lastSync: string | null
  status: string
  lat: string
  lng: string
}

export function getGpsTracks(
  devices: Device[] = defaultDevices as Device[],
  vehicles: Vehicle[] = defaultVehicles as Vehicle[],
  organizations: Organization[] = defaultOrganizations as Organization[],
): GpsTrackView[] {
  const orgById = new Map(organizations.map((o) => [o.id, o.name]))
  const vehicleById = new Map(vehicles.map((v) => [v.id, v.license_plate]))

  return (devices as Device[])
    .filter((d) => d.device_type === 'GPS')
    .map((d) => {
      const [lat, lng] = d.last_known_position ?? [null, null]
      const plate = d.assigned_to_vehicle_id ? vehicleById.get(d.assigned_to_vehicle_id) : undefined
      return {
        id: d.id,
        serial: d.serial_number,
        position: d.last_known_position ?? null,
        vehiclePlate: plate ?? '',
        orgName: d.org_id ? (orgById.get(d.org_id) ?? '') : '',
        lastSync: d.last_sync ?? null,
        status: d.status,
        lat: lat != null ? lat.toFixed(4) : '—',
        lng: lng != null ? lng.toFixed(4) : '—',
      }
    })
}

export function getGpsTrackSummary(
  devices: Device[] = defaultDevices as Device[],
  vehicles: Vehicle[] = defaultVehicles as Vehicle[],
  organizations: Organization[] = defaultOrganizations as Organization[],
) {
  const tracks = getGpsTracks(devices, vehicles, organizations)
  return {
    total: tracks.length,
    located: tracks.filter((t) => t.position).length,
    unlocated: tracks.filter((t) => !t.position).length,
  }
}
