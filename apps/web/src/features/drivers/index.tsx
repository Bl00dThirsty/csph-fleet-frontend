import { useCallback, useMemo, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import {
  getDriverById,
  getDriversView,
  drivers,
  type Driver,
  type DriverView,
} from './data/drivers'
import { DriversTable } from './components/drivers-table'
import { DriverDetailsSheet } from './components/driver-details-sheet'
import { EntityFormSheet, useEntityCrud } from '@/components/entity-crud'
import { driverFields, driverFromForm, driverToForm } from './data/drivers-crud'
import { toast } from 'sonner'

export { getDriverById, getDriversView, drivers }
export type { Driver, DriverView }

const route = getRouteApi('/_authenticated/drivers/')

export function buildDriverOrgOptions(drivers: readonly DriverView[]) {
  return Array.from(new Set(drivers.map((driver) => driver.org_name))).map(
    (org_name) => ({
      label: org_name,
      value: org_name,
    })
  )
}

export function DriversPage() {
  const [, setVersion] = useState(0)
  const drivers = getDriversView()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [detailsDriver, setDetailsDriver] = useState<DriverView | null>(null)
  const crud = useEntityCrud<Driver>('drivers', 'drivers', ['drivers'])

  const handleViewDetails = useCallback((driver: DriverView) => {
    setDetailsDriver(driver)
  }, [])

  async function handleSubmit(values: Record<string, unknown>) {
    try {
      if (crud.editing) {
        await crud.updateMut.mutateAsync({ id: crud.editing.id, patch: driverFromForm(values) })
        toast.success('Chauffeur mis à jour.')
      } else {
        await crud.createMut.mutateAsync(driverFromForm(values) as Omit<Driver, 'id'>)
        toast.success('Chauffeur créé.')
      }
      crud.close()
      setVersion((v) => v + 1)
    } catch {
      toast.error('Échec de l’enregistrement.')
    }
  }

  const orgOptions = useMemo(() => buildDriverOrgOptions(drivers), [drivers])

  return (
    <Main className='space-y-4 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900'>
      <section className='rounded-2xl border-transparent bg-background/88 p-4 shadow-sm backdrop-blur-sm'>
        <div className='flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between'>
          <div className='flex flex-wrap items-center gap-2'>
            <TopStat
              label='Actifs'
              value={`${drivers.filter((d) => d.is_active).length}/${drivers.length}`}
            />
            <TopStat label='Entreprises' value={String(orgOptions.length)} />
          </div>

          {crud.perm.canCreate && (
            <Button onClick={crud.openCreate}>
              <Plus className='mr-1 h-4 w-4' /> Nouveau chauffeur
            </Button>
          )}
        </div>

        <div className='mt-4 space-y-1'>
          <h1 className='text-[30px] leading-none font-semibold tracking-tight sm:text-3xl'>
            Chauffeurs / Vaitiers
          </h1>
          <p className='text-sm text-muted-foreground'>
            Registre de la flotte des chauffeurs et vaitiers GPL.
          </p>
        </div>
      </section>

      <section className='space-y-4 rounded-xl border-transparent bg-background/92 p-4 shadow-sm'>
        <div className='flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <h2 className='text-xl font-semibold tracking-tight'>
              Liste des chauffeurs
            </h2>
            <p className='text-sm text-muted-foreground'>
              Selectionnez un chauffeur pour voir sa fiche detaillee.
            </p>
          </div>
          <Badge
            variant='outline'
            className='border-transparent bg-muted/35 text-foreground'
          >
            {drivers.length} chauffeurs
          </Badge>
        </div>
        <DriversTable
          data={drivers}
          search={search}
          navigate={navigate}
          orgOptions={orgOptions}
          onViewDetails={handleViewDetails}
          onEdit={(d) => crud.openEdit(d as unknown as Driver)}
          onDelete={async (d) => {
            await crud.removeMut.mutateAsync(d.id)
            setVersion((v) => v + 1)
          }}
        />
      </section>

      <DriverDetailsSheet
        driver={detailsDriver}
        open={detailsDriver !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsDriver(null)
        }}
      />

      <EntityFormSheet
        open={crud.creating || crud.editing !== null}
        onOpenChange={(open) => {
          if (!open) crud.close()
        }}
        title={crud.editing ? 'Modifier le chauffeur' : 'Nouveau chauffeur'}
        description={crud.editing ? 'Mettez à jour les informations du chauffeur.' : 'Ajoutez un chauffeur à la flotte.'}
        fields={driverFields}
        initial={crud.editing ? driverToForm(crud.editing) : null}
        onSubmit={handleSubmit}
        onCancel={crud.close}
        submitting={crud.createMut.isPending || crud.updateMut.isPending}
      />
    </Main>
  )
}

function TopStat({ label, value }: { label: string; value: string }) {
  return (
    <div className='inline-flex items-center gap-1.5 rounded-full border-transparent bg-background/90 px-2.5 py-1 text-xs shadow-xs'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='font-semibold'>{value}</span>
    </div>
  )
}