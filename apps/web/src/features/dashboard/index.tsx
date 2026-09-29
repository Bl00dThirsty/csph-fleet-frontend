import { useEffect, useMemo } from 'react'
import { ArrowDownToLine, Inbox, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { type Role } from '@/config/rbac/roles'
import { Main } from '@/components/layout/main'
import { useAuthStore } from '@/store/auth-store'
import { useRoleStore } from '@/store/role-store'
import { useToursStore } from '@/store/tours-store'
import {
  organizationsHooks,
  sitesHooks,
  vehiclesHooks,
} from '@/lib/api/use-resources'
import type { NavigateFn } from '@/hooks/use-table-url-state'
import { DateRangePicker } from '@/components/date-range-picker'
import { buildDashboardView } from './data/dashboard'
import {
  filterToursByRange,
  formatRangeLabel,
  parseRangeSearch,
  presetRange,
  serializeRangeSearch,
} from './lib/date-range'
import { toTourActivities } from '@/features/tours/data/tour-activity'
import { getTrucks } from '@/features/trucks/data/trucks'
import { getSites } from '@/features/sites/data/sites'
import { LpgKpiStrip } from './components/lpg-kpi-strip'
import { LpgDeliveryFlow } from './components/lpg-delivery-flow'
import { RegionalTraceabilityQuality } from './components/regional-traceability-quality'
import { RegionalVolumeCadence } from './components/regional-volume-cadence'

function errorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export function DashboardPage({
  role,
  search,
  navigate,
}: {
  role?: Role
  search: Record<string, unknown>
  navigate: NavigateFn
}) {
  const user = useAuthStore((s) => s.user)
  const activeRole = useRoleStore((s) => s.activeRole)
  const effectiveRole = role ?? activeRole ?? (user?.system_role as Role) ?? 'SUPERADMIN'

  const storeTours = useToursStore((s) => s.tours)
  const toursLoading = useToursStore((s) => s.loading)
  const toursError = useToursStore((s) => s.error)
  const vehiclesQuery = vehiclesHooks.useList({ limit: 100 })
  const sitesQuery = sitesHooks.useList({ limit: 100 })
  const orgsQuery = organizationsHooks.useList({ limit: 100 })

  useEffect(() => {
    useToursStore.getState().fetchTours()
  }, [])

  const range = useMemo(
    () => parseRangeSearch(search) ?? presetRange('30d'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search.from, search.to],
  )

  const handleRangeChange = (next: { from: Date; to: Date }) => {
    navigate({
      search: (prev) => ({ ...(prev as Record<string, unknown>), ...serializeRangeSearch(next) }),
    })
  }

  // Org scoping on live rows (strict org_id match — no name heuristics).
  const scopedTours = useMemo(() => {
    if (effectiveRole === 'MARKETEUR' && user?.org_id) {
      return storeTours.filter((t) => t.marketeur_org_id === user.org_id)
    }
    if (effectiveRole === 'TRANSPORTEUR' && user?.org_id) {
      return storeTours.filter((t) => t.transporter_org_id === user.org_id)
    }
    return storeTours
  }, [storeTours, effectiveRole, user?.org_id])

  const rangedTours = useMemo(() => filterToursByRange(scopedTours, range), [scopedTours, range])

  const orgs = useMemo(() => orgsQuery.data ?? [], [orgsQuery.data])
  const vehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data])
  const truckRows = useMemo(
    () => getTrucks(vehicles, orgs),
    [vehicles, orgs],
  )
  const orgsById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const org of orgs) map[org.id] = org.name
    return map
  }, [orgs])
  const siteRows = useMemo(
    () => getSites(sitesQuery.data ?? [], orgsById),
    [sitesQuery.data, orgsById],
  )
  const activities = useMemo(
    () =>
      toTourActivities(rangedTours, {
        organizations: orgs,
        vehicles,
        trucks: truckRows,
        sites: siteRows,
      }),
    [rangedTours, orgs, vehicles, truckRows, siteRows],
  )

  const dashboard = useMemo(
    () =>
      buildDashboardView(effectiveRole, user?.org_id, user?.org_name, {
        routes: activities,
        trucks: truckRows,
        sites: siteRows,
      }),
    [effectiveRole, user?.org_id, user?.org_name, activities, truckRows, siteRows],
  )

  const heading =
    effectiveRole === 'SUPERADMIN'
      ? 'Pilotage National — Traçabilité Hors Réseau'
      : effectiveRole === 'ADMIN'
        ? 'Tableau de Bord Administration'
        : effectiveRole === 'SUPERVISOR'
          ? 'Supervision des Flux & Traçabilité'
          : effectiveRole === 'MARKETEUR'
            ? 'Pilotage Marketeur — Distribution Hors Réseau'
            : effectiveRole === 'TRANSPORTEUR'
              ? 'Suivi Flotte & Acheminement Entreprises'
              : 'Tableau de Bord Traçabilité GPL'

  const subtitle =
    effectiveRole === 'SUPERADMIN'
      ? 'Suivi exécutif de la traçabilité du gaz hors réseau (Bouteilles 50 kg & Vrac), des tournées et du tracking de la flotte.'
      : effectiveRole === 'MARKETEUR'
        ? 'Suivi des livraisons vrac et bouteilles 50 kg destinées aux entreprises et clients industriels.'
        : effectiveRole === 'TRANSPORTEUR'
          ? 'Tracking en temps réel des camions citernes et plateaux 50 kg en tournée.'
          : 'Vue consolidée et simplifiée de la distribution de GPL hors réseau pour le top management.'

  const isLoading =
    toursLoading ||
    vehiclesQuery.isPending ||
    sitesQuery.isPending ||
    orgsQuery.isPending
  const loadError =
    toursError ??
    vehiclesQuery.error ??
    sitesQuery.error ??
    orgsQuery.error
  const isEmpty = !isLoading && !loadError && activities.length === 0

  return (
    <Main fluid className='flex flex-col gap-6 bg-muted/20 pb-10'>
      {/* En-tête exécutif */}
      <section className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex flex-col gap-1'>
          <h1 className='font-manrope text-2xl font-bold tracking-tight text-foreground sm:text-3xl'>
            {heading}
          </h1>
          <p className='max-w-3xl text-xs text-muted-foreground sm:text-sm'>
            {subtitle}
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <DateRangePicker value={range} onChange={handleRangeChange} />
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-9 rounded-lg bg-background text-xs shadow-none'
          >
            <ArrowDownToLine data-icon='inline-start' />
            Exporter
          </Button>
        </div>
      </section>

      {isLoading ? (
        <section className='flex flex-col gap-6' aria-label='Chargement du tableau de bord'>
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-5'>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className='h-28 rounded-xl' />
            ))}
          </div>
          <Skeleton className='h-72 rounded-xl' />
          <div className='grid grid-cols-1 gap-6 xl:grid-cols-12'>
            <Skeleton className='h-80 rounded-xl xl:col-span-7' />
            <Skeleton className='h-80 rounded-xl xl:col-span-5' />
          </div>
        </section>
      ) : loadError ? (
        <section className='flex flex-col items-center gap-2 rounded-xl border border-destructive/30 bg-background px-6 py-16 text-center'>
          <TriangleAlert className='size-8 text-destructive' />
          <h2 className='text-lg font-semibold'>Données indisponibles</h2>
          <p className='max-w-md text-sm text-muted-foreground'>
            {errorText(loadError, 'Le tableau de bord ne peut pas charger les données — vérifiez la liaison API.')}
          </p>
        </section>
      ) : (
        <>
          {/* Range courante (rappel sous l'en-tête) */}
          <p className='text-xs text-muted-foreground'>
            Période : {formatRangeLabel(range.from, range.to)} — {activities.length} tournée(s)
          </p>

          {isEmpty ? (
            <section className='flex flex-col items-center gap-2 rounded-xl border bg-background px-6 py-16 text-center'>
              <Inbox className='size-8 text-muted-foreground' />
              <h2 className='text-lg font-semibold'>Aucune tournée sur la période</h2>
              <p className='max-w-md text-sm text-muted-foreground'>
                Aucune donnée pour cette plage de dates. Élargissez la période ou
                vérifiez que des tournées existent pour votre organisation.
              </p>
            </section>
          ) : (
            <>
              {/* Bloc 1 : Bandeau KPI Exécutif (Vrac, 50kg, Tournées, Camions tracés, Conformité) */}
              <section>
                <LpgKpiStrip
                  totalDeliveredTM={dashboard.overview.totalDeliveredTM}
                  totalTransportedTM={dashboard.overview.totalTransportedTM}
                  activeTrips={dashboard.overview.activeTrips}
                  activeTrucks={dashboard.overview.activeTrucks}
                  totalTrucks={dashboard.overview.totalTrucks}
                />
              </section>

              {/* Bloc 2 : Flux des Livraisons Hors Réseau (Tonnages mensuels & Bons validés) */}
              <section>
                <LpgDeliveryFlow />
              </section>

              {/* Bloc 3 : Qualité de Traçabilité (10 Régions) & Cadence des Volumes Livrés (1 Mois) */}
              <section className='grid grid-cols-1 gap-6 xl:grid-cols-12'>
                <div className='xl:col-span-7'>
                  <RegionalTraceabilityQuality />
                </div>
                <div className='xl:col-span-5'>
                  <RegionalVolumeCadence />
                </div>
              </section>
            </>
          )}
        </>
      )}
    </Main>
  )
}
