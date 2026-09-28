import { api } from '@lpg/api-client'
import type { Vehicle } from '@lpg/types'

export const truckStatusLabels: Record<string, string> = {
  AVAILABLE: 'Disponible',
  IN_TRANSIT: 'En livraison',
  MAINTENANCE: 'Maintenance',
  INACTIVE: 'Inactif',
}

/**
 * Empty placeholder for backwards compatibility with sync consumers. Pages
 * should call `getTransporterTrucks()` on mount and store the result.
 */
export const transporterTrucks: Vehicle[] = []

/**
 * Live fetch — replaces the previous `curated.vehicles` seed. Optional
 * `orgId` filter narrows the list to vehicles belonging to a transporter.
 */
export async function getTransporterTrucks(orgId?: string): Promise<Vehicle[]> {
  try {
    const res = await api.vehicles.list(orgId ? { orgId, size: 200 } : { size: 200 })
    let list = ((res.data ?? []) as unknown) as Vehicle[]
    if (orgId) list = list.filter((v) => (v as any).org_id === orgId)
    return list.filter((v) => (v as any).is_active !== false)
  } catch {
    return []
  }
}