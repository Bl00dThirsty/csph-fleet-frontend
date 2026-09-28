import type {
  Driver,
  Organization,
  TourneeStatus,
} from '@lpg/types'
import { useUsersStore } from '@/store/users-store'
import { useToursStore } from '@/store/tours-store'

export type DriverStatus = 'ACTIVE' | 'INACTIVE'

export type DriverView = {
  id: string
  first_name: string
  last_name: string
  full_name: string
  license_number: string
  org_id: string
  org_name: string
  is_active: boolean
  assigned_vehicle_count: number
  active_tour_count: number
  total_tour_count: number
  last_activity: string
}

export const driverStatusLabels: Record<DriverStatus, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
}

export const driverStatusClasses: Record<DriverStatus, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  INACTIVE: 'bg-muted text-muted-foreground',
}

export const driverStatusOptions = [
  { label: 'Actif', value: 'ACTIVE' },
  { label: 'Inactif', value: 'INACTIVE' },
] as const satisfies ReadonlyArray<{
  label: string
  value: DriverStatus
}>

const activeTourStatuses: readonly TourneeStatus[] = [
  'INPROGRESS',
  'CHECKPOINTACTIVE',
]

function orgName(orgById: Map<string, Organization>, orgId: string): string {
  return orgById.get(orgId)?.name ?? '—'
}

function buildTourAggregates(): ReadonlyMap<
  string,
  { vehicles: Set<string>; active: number; total: number; lastUpdatedAt: string }
> {
  const aggregates = new Map<
    string,
    { vehicles: Set<string>; active: number; total: number; lastUpdatedAt: string }
  >()
  const tours = useToursStore.getState().tours

  for (const tour of tours) {
    if (!tour.driver_id) continue

    let entry = aggregates.get(tour.driver_id)
    if (!entry) {
      entry = {
        vehicles: new Set<string>(),
        active: 0,
        total: 0,
        lastUpdatedAt: '',
      }
      aggregates.set(tour.driver_id, entry)
    }

    entry.total += 1
    if (tour.vehicle_id) entry.vehicles.add(tour.vehicle_id)
    if (activeTourStatuses.includes(tour.status)) entry.active += 1

    const updated = tour.updated_at ?? ''
    if (updated && (!entry.lastUpdatedAt || updated > entry.lastUpdatedAt)) {
      entry.lastUpdatedAt = updated
    }
  }

  return aggregates
}

function buildView(
  driver: Driver,
  orgById: Map<string, Organization>,
  aggregates: ReturnType<typeof buildTourAggregates>,
): DriverView {
  const agg = aggregates.get(driver.id)
  return {
    id: driver.id,
    first_name: driver.first_name,
    last_name: driver.last_name,
    full_name: `${driver.first_name} ${driver.last_name}`.trim(),
    license_number: driver.license_number ?? '—',
    org_id: driver.org_id,
    org_name: orgName(orgById, driver.org_id),
    is_active: driver.is_active,
    assigned_vehicle_count: agg?.vehicles.size ?? 0,
    active_tour_count: agg?.active ?? 0,
    total_tour_count: agg?.total ?? 0,
    last_activity:
      agg?.lastUpdatedAt ??
      driver.updated_at ??
      driver.created_at ??
      '',
  }
}

/**
 * Synchronous accessor — derives drivers from the live users-store filtered by
 * `system_role === 'DRIVER'`. Pages that want a populated list should call
 * `useUsersStore.getState().fetchUsers()` + `useToursStore.getState().fetchTours()`
 * on mount.
 */
export function getDriversView(
  orgs: Organization[] = [],
): DriverView[] {
  const orgById = new Map(orgs.map((o) => [o.id, o]))
  const aggregates = buildTourAggregates()
  const drivers = useUsersStore
    .getState()
    .users
    .filter((u) => (u as any).system_role === 'DRIVER' || (u as any).role_codes?.includes('DRIVER'))
    .map((u) => u as unknown as Driver)
  return drivers.map((d) => buildView(d, orgById, aggregates))
}

export function getDriverById(id: string, orgs: Organization[] = []): DriverView | undefined {
  return getDriversView(orgs).find((driver) => driver.id === id)
}

// Backwards-compatible empty seeds.
export const drivers: Driver[] = []
export const organizations: Organization[] = []

export type { Driver, Organization }