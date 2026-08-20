import { useState } from 'react'
import { toast } from 'sonner'
import { curated } from '@lpg/mock-data'
import type { ExecutionMode, TourneeType } from '@lpg/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@lpg/ui'
import { useToursStore, type TourDraft } from '@/store/tours-store'

interface TourCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function TourCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: TourCreateDialogProps) {
  const defaultMarketer = curated.organizations.find((o) => o.type === 'MARKETEUR')?.id ?? 'org-0002-sctm-0000-000000000001'
  const defaultTransporter = curated.organizations.find((o) => o.type === 'TRANSPORTEUR')?.id ?? 'org-0011-expressgpl--000000000001'

  const [tourCode, setTourCode] = useState(`TRP-${Math.floor(1000 + Math.random() * 9000)}`)
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('INTERNAL')
  const [cargoType, setCargoType] = useState<TourneeType>('VRAC')
  const [quantity, setQuantity] = useState<number>(5) // 5 TM by default
  const [marketerId, setMarketerId] = useState(defaultMarketer)
  const [transporterId, setTransporterId] = useState(defaultTransporter)
  const [vehicleId, setVehicleId] = useState(curated.vehicles.find((v) => v.type === 'VRAC')?.id ?? '')
  const [driverId, setDriverId] = useState(curated.drivers[0]?.id ?? '')
  const [livreurId, setLivreurId] = useState(curated.users.find((u) => u.system_role === 'LIVREUR')?.id ?? 'user-0010-sctm-livreur1')
  const [submitting, setSubmitting] = useState(false)

  // Filter vehicles matching current cargo type
  const availableVehicles = curated.vehicles.filter((v) => v.type === cargoType)
  const availableMarketers = curated.organizations.filter((o) => o.type === 'MARKETEUR')
  const availableTransporters = curated.organizations.filter((o) => o.type === 'TRANSPORTEUR')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      // 1 TM (Tonne Métrique) = 1 000 kg for VRAC, BTL = count for 50kg bottles
      const quantityInKgOrUnits = cargoType === 'VRAC' ? Number(quantity) * 1000 : Number(quantity)
      const draft: TourDraft = {
        tour_code: tourCode.trim(),
        marketeur_org_id: marketerId,
        execution_mode: executionMode,
        type: cargoType,
        requested_quantity: quantityInKgOrUnits,
        transporter_org_id: executionMode === 'EXTERNAL' ? transporterId : null,
        vehicle_id: executionMode === 'INTERNAL' ? vehicleId : null,
        driver_id: executionMode === 'INTERNAL' ? driverId : null,
        livreur_user_id: executionMode === 'INTERNAL' ? livreurId : null,
      }

      await useToursStore.getState().createTourAsync(draft)
      toast.success(`Tournée ${tourCode} créée avec succès`)
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création de la tournée')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Créer une tournée de livraison (Flux 2)</DialogTitle>
            <DialogDescription>
              Planifiez une nouvelle mission de distribution GPL vers les clients et dépôts.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            {/* Code & Mode */}
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
                  Code Tournée
                </label>
                <input
                  type='text'
                  required
                  value={tourCode}
                  onChange={(e) => setTourCode(e.target.value)}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm'
                />
              </div>
              <div>
                <label className='block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
                  Mode d'exécution
                </label>
                <select
                  value={executionMode}
                  onChange={(e) => {
                    const nextMode = e.target.value as ExecutionMode
                    setExecutionMode(nextMode)
                  }}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm'
                >
                  <option value='INTERNAL'>Interne (Propre flotte)</option>
                  <option value='EXTERNAL'>Sous-traitée (Transporteur)</option>
                </select>
              </div>
            </div>

            {/* Type & Quantité */}
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
                  Type de cargaison
                </label>
                <select
                  value={cargoType}
                  onChange={(e) => {
                    const nextCargo = e.target.value as TourneeType
                    setCargoType(nextCargo)
                    const matchingVeh = curated.vehicles.find((v) => v.type === nextCargo)
                    if (matchingVeh) setVehicleId(matchingVeh.id)
                  }}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm'
                >
                  <option value='VRAC'>VRAC (Citerne — TM)</option>
                  <option value='BOUTEILLES50KG'>Bouteilles 50 kg (Plateau — BTL)</option>
                </select>
              </div>
              <div>
                <label className='block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
                  Quantité demandée ({cargoType === 'VRAC' ? 'Tonnes Métriques - TM' : 'Bouteilles 50 kg - BTL'})
                </label>
                <input
                  type='number'
                  required
                  min={0.1}
                  step={cargoType === 'VRAC' ? '0.1' : '1'}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm'
                />
              </div>
            </div>

            {/* Marketeur */}
            <div>
              <label className='block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
                Marketeur donneur d'ordre
              </label>
              <select
                value={marketerId}
                onChange={(e) => setMarketerId(e.target.value)}
                className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm'
              >
                {availableMarketers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.registration_number ?? m.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Si EXTERNAL: Transporteur */}
            {executionMode === 'EXTERNAL' && (
              <div>
                <label className='block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
                  Transporteur assigné
                </label>
                <select
                  value={transporterId}
                  onChange={(e) => setTransporterId(e.target.value)}
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm'
                >
                  {availableTransporters.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.id})
                    </option>
                  ))}
                </select>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Le véhicule et le chauffeur seront affectés par le transporteur lors de l'accusé de réception.
                </p>
              </div>
            )}

            {/* Si INTERNAL: Véhicule, Chauffeur, Livreur */}
            {executionMode === 'INTERNAL' && (
              <>
                <div>
                  <label className='block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
                    Véhicule assigné ({cargoType})
                  </label>
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm'
                  >
                    {availableVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.license_plate} ({v.type} — {v.max_volume ? `${v.max_volume} m³` : `${v.max_bottle_count ?? ''} btl`})
                      </option>
                    ))}
                  </select>
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
                      Chauffeur
                    </label>
                    <select
                      value={driverId}
                      onChange={(e) => setDriverId(e.target.value)}
                      className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm'
                    >
                      {curated.drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.first_name} {d.last_name} ({d.license_number})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className='block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
                      Livreur PDA
                    </label>
                    <select
                      value={livreurId}
                      onChange={(e) => setLivreurId(e.target.value)}
                      className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm'
                    >
                      {curated.users.filter((u) => u.system_role === 'LIVREUR').map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type='submit' disabled={submitting}>
              {submitting ? 'Création...' : 'Créer la tournée'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
