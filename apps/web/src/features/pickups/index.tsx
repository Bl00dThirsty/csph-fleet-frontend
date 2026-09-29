import { useMemo, useEffect, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@lpg/ui'
import { vehicles as vehiclesData } from '@/lib/entity-data'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell, SectionCard } from '@/components/layout/page'
import { usePickupsStore } from '@/store/pickups-store'
import { PickupsTable } from './components/pickups-table'
import { PickupsCreateWizard } from './components/pickups-create-wizard'
import { PickupsValidateDialog } from './components/pickups-validate-dialog'
import { getPickupSummary, type Pickup } from './data/pickups'
import type { PickupRequest } from '@lpg/types'
import type { Role } from '@/config/rbac/roles'

import { useAuthStore } from '@/store/auth-store'

const route = getRouteApi('/_authenticated/pickups/')

export function PickupsPage({ role }: { role: Role }) {
  const user = useAuthStore((s) => s.user)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const storePickups = usePickupsStore((s) => s.pickups)
  const allRows = useMemo(
    () => usePickupsStore.getState().getPickupsView(),
    [storePickups]
  )
  const assignedVehicles = usePickupsStore((s) => s.assignedVehicles)
  const [createOpen, setCreateOpen] = useState(false)
  const [validateOpen, setValidateOpen] = useState<Pickup | null>(null)
  const [detailOpen, setDetailOpen] = useState<Pickup | null>(null)

  const rows = useMemo(() => {
    if (role === 'MARKETEUR' && (user?.org_id || user?.org_name)) {
      const orgKey = (user.org_name || user.org_id || '').toLowerCase()
      const filtered = allRows.filter((r) => r.marketeur_name.toLowerCase().includes('sctm') || (orgKey && r.marketeur_name.toLowerCase().includes(orgKey)))
      return filtered.length > 0 ? filtered : allRows
    }
    return allRows
  }, [allRows, role, user?.org_id, user?.org_name])

  useEffect(() => {
    usePickupsStore.getState().fetchPickups()
  }, [])

  const summary = getPickupSummary(rows)

  const handleCreated = (created: PickupRequest, vehicleIds: string[]) => {
    if (vehicleIds.length > 0) {
      toast.success(`${created.reference ?? created.id} crÃ©Ã©e â€” ${vehicleIds.length} vÃ©hicule(s) assignÃ©(s)`)
    }
  }

  const handleValidate = async (row: Pickup, qty: number) => {
    try {
      await usePickupsStore.getState().approvePickupAsync(row.id, qty)
      toast.success(`${row.reference} validÃ©e pour ${qty.toLocaleString('fr-FR')} TM`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de validation')
    }
  }

  const handleCancel = async (row: Pickup) => {
    try {
      await usePickupsStore.getState().cancelPickupAsync(row.id)
      toast.warning(`${row.reference} annulÃ©e`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'annulation')
    }
  }

  const detailVehicleIds = detailOpen ? assignedVehicles[detailOpen.id] ?? [] : []
  const detailVehicles = detailVehicleIds
    .map((vid) => vehiclesData.find((v) => v.id === vid)?.license_plate ?? vid)
    .join(', ')

  return (
    <PageShell>
      <PageHeader
        title='Approvisionnements (Flux 1)'
        description={`${summary.total} requÃªtes â€” ${summary.draft} brouillon(s), ${summary.validated} validÃ©e(s), ${summary.inProgress} en cours, ${summary.completed} terminÃ©e(s).`}
        actions={
          role === 'MARKETEUR' || role === 'ADMIN' || role === 'SUPERADMIN' ? (
            <Button className='gap-2' onClick={() => setCreateOpen(true)}>
              <Plus className='size-4' /> Nouvelle requÃªte
            </Button>
          ) : null
        }
      />
      <SectionCard>
        <PickupsTable
          rows={rows}
          search={search}
          navigate={navigate}
          onOpenDetails={(row) => {
            if ((role === 'ADMIN' || role === 'SUPERADMIN') && row.pickup_status === 'DRAFT') {
              setValidateOpen(row)
            } else {
              setDetailOpen(row)
            }
          }}
        />
      </SectionCard>

      <PickupsCreateWizard
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      <PickupsValidateDialog
        pickup={validateOpen}
        open={validateOpen !== null}
        onOpenChange={(o) => { if (!o) setValidateOpen(null) }}
        onValidate={(qty) => validateOpen && handleValidate(validateOpen, qty)}
      />

      <Dialog open={detailOpen !== null && validateOpen === null} onOpenChange={(o) => { if (!o) setDetailOpen(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailOpen?.reference ?? 'â€”'}</DialogTitle>
          </DialogHeader>
          {detailOpen && (
            <div className='space-y-2 py-2 text-sm'>
              <p>Marketeur: {detailOpen.marketeur_name}</p>
              <p>Source: {detailOpen.source_name}</p>
              <p>Destination: {detailOpen.destination_name}</p>
              <p>QuantitÃ© demandÃ©e: {detailOpen.requested_quantity.toLocaleString('fr-FR')} TM</p>
              <p>QuantitÃ© approuvÃ©e: {detailOpen.approved_quantity?.toLocaleString('fr-FR') ?? 'â€”'}</p>
              <p>Statut: {detailOpen.pickup_status}</p>
              {detailVehicleIds.length > 0 && (
                <p>VÃ©hicules: {detailVehicles}</p>
              )}
            </div>
          )}
          {(role === 'MARKETEUR' || role === 'ADMIN' || role === 'SUPERADMIN') && detailOpen?.pickup_status !== 'CANCELLED' && detailOpen?.pickup_status !== 'COMPLETED' ? (
            <DialogFooter>
              <Button variant='destructive' onClick={() => { if (detailOpen) handleCancel(detailOpen); setDetailOpen(null) }}>
                Annuler la requÃªte
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}