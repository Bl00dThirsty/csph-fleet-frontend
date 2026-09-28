import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@lpg/api-client'
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

interface OrgOption {
  id: string
  name: string
  type: string
}

interface VehicleOption {
  id: string
  type: string
  license_plate: string
  max_volume?: number | null
  max_bottle_count?: number | null
}

interface DriverOption {
  id: string
  first_name: string
  last_name: string
  license_number?: string
}

interface LivreurOption {
  id: string
  first_name: string
  last_name: string
}

export function TourCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: TourCreateDialogProps) {
  const [tourCode, setTourCode] = useState(`TRP-${Math.floor(1000 + Math.random() * 9000)}`)
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('INTERNAL')
  const [cargoType, setCargoType] = useState<TourneeType>('VRAC')
  const [quantity, setQuantity] = useState<number>(5)
  const [marketerId, setMarketerId] = useState<string>('')
  const [transporterId, setTransporterId] = useState<string>('')
  const [vehicleId, setVehicleId] = useState<string>('')
  const [driverId, setDriverId] = useState<string>('')
  const [livreurId, setLivreurId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Live data fetched from the Spring backend. No curated.* mock-data
  // fallback — the dialog starts empty until the lists arrive.
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [livreurs, setLivreurs] = useState<LivreurOption[]>([])
  const [dataError, setDataError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setDataError(null)
    ;(async () => {
      try {
        const [orgRes, vehRes, drvRes, usrRes] = await Promise.all([
          api.organizations.list({ size: 200 }),
          api.vehicles.list({ size: 200 }),
          // Drivers are a /users/ sub-collection on the backend.
          api.users.list({ size: 200 }),
          api.users.list({ size: 200 }),
        ])
        if (cancelled) return
        setOrgs(((orgRes.data ?? []) as unknown) as OrgOption[])
        setVehicles(((vehRes.data ?? []) as unknown) as VehicleOption[])
        const drvRows = (((drvRes.data ?? []) as any[]) || []).filter(
          (u) => u?.system_role === 'DRIVER',
        ) as DriverOption[]
        setDrivers(drvRows)
        const livRows = (((usrRes.data ?? []) as any[]) || []).filter(
          (u) => u?.system_role === 'LIVREUR',
        ) as LivreurOption[]
        setLivreurs(livRows)

        // Defaults: pick the first matching option if the user hasn't set one.
        setMarketerId((current) =>
          current || ((orgRes.data ?? []) as OrgOption[]).find((o) => o.type === 'MARKETEUR')?.id || '',
        )
        setTransporterId((current) =>
          current || ((orgRes.data ?? []) as OrgOption[]).find((o) => o.type === 'TRANSPORTEUR')?.id || '',
        )
        setVehicleId((current) => current || '')
        setDriverId((current) => current || drvRows[0]?.id || '')
        setLivreurId((current) => current || livRows[0]?.id || '')
      } catch (err) {
        if (!cancelled) return
        const message = err instanceof Error ? err.message : 'Erreur réseau — listes indisponibles.'
        setDataError(message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const availableVehicles = vehicles.filter((v) => v.type === cargoType)
  const availableMarketers = orgs.filter((o) => o.type === 'MARKETEUR')
  const availableTransporters = orgs.filter((o) => o.type === 'TRANSPORTEUR')

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
        vehicle_id: executionMode === 'INTERNAL' ? vehicleId || null : null,
        driver_id: executionMode === 'INTERNAL' ? driverId || null : null,
        livreur_user_id: executionMode === 'INTERNAL' ? livreurId || null : null,
      }

      await useToursStore.getState().createTourAsync(draft)
      toast.success(`Tournée ${tourCode} créée en base`)
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

          {dataError && (
            <div className='my-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300'>
              Données de référence indisponibles : {dataError}. Vérifiez que l'API est accessible et réessayez.
            </div>
          )}

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
                    const matchingVeh = availableVehicles.find((v) => v.type === nextCargo)
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
                <option value=''>— Sélectionner —</option>
                {availableMarketers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
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
                  <option value=''>— Sélectionner —</option>
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
                    <option value=''>— Sélectionner —</option>
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
                      <option value=''>— Sélectionner —</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.first_name} {d.last_name} {d.license_number ? `(${d.license_number})` : ''}
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
                      <option value=''>— Sélectionner —</option>
                      {livreurs.map((u) => (
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
            <Button type='submit' disabled={submitting || !marketerId}>
              {submitting ? 'Création...' : 'Créer la tournée'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}