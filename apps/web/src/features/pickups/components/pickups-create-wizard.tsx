import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, Truck } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@lpg/ui'
import { curated, organizations, sites } from '@lpg/mock-data'
import { useAuthStore } from '@/store/auth-store'
import { usePickupsStore } from '@/store/pickups-store'
import type { PickupRequest, VehicleType } from '@lpg/types'
import { recommendVehicles, type VehicleRecommendation } from '../lib/vehicle-recommendation'
import { pickupWizardSchema, type PickupWizardValues } from '../lib/pickup-wizard-schema'

const MARKET_EUR_ORGS = organizations.filter((o) => o.type === 'MARKETEUR' && o.is_active)

function defaultMarketeurOrg(): string {
  const authOrg = useAuthStore.getState().user?.org_id
  if (authOrg && MARKET_EUR_ORGS.some((o) => o.id === authOrg)) return authOrg
  return MARKET_EUR_ORGS[0]?.id ?? ''
}

const TYPE_LABELS: Record<VehicleType, string> = {
  VRAC: 'GPL vrac (TM)',
  BOUTEILLES50KG: 'Bouteilles 50 kg (btl)',
}

export function PickupsCreateWizard({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (pickup: PickupRequest, vehicleIds: string[]) => void
}) {
  const [step, setStep] = useState(1)
  const [values, setValues] = useState<PickupWizardValues>({
    marketeur_org_id: defaultMarketeurOrg(),
    source_site_id: '',
    destination_site_id: '',
    requested_quantity: 0,
    type: 'VRAC',
  })
  const [errors, setErrors] = useState<string[]>([])
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const sourceOptions = useMemo(
    () => sites.filter((s) => s.is_active !== false),
    [],
  )
  const destOptions = useMemo(
    () => sites.filter((s) => s.is_active !== false && s.id !== values.source_site_id),
    [values.source_site_id],
  )

  const recommendations = useMemo<VehicleRecommendation[]>(() => {
    if (step !== 2 || values.requested_quantity <= 0) return []
    return recommendVehicles({
      quantity: values.requested_quantity,
      type: values.type,
      org_id: values.marketeur_org_id,
      vehicles: curated.vehicles,
    })
  }, [step, values.requested_quantity, values.type, values.marketeur_org_id])

  function validateStep1(): boolean {
    const res = pickupWizardSchema.safeParse(values)
    if (res.success) {
      setErrors([])
      return true
    }
    setErrors(res.error.issues.map((i) => i.message))
    return false
  }

  function set<K extends keyof PickupWizardValues>(key: K, value: PickupWizardValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function toggleVehicle(id: string) {
    setSelectedVehicles((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    )
  }

  async function submit() {
    if (step === 1) {
      if (!validateStep1()) return
      setStep(2)
      return
    }
    setSubmitting(true)
    try {
      const created = await usePickupsStore.getState().createPickupAsync({
        marketeur_org_id: values.marketeur_org_id,
        source_site_id: values.source_site_id,
        destination_site_id: values.destination_site_id,
        requested_quantity: values.requested_quantity,
      }, selectedVehicles)
      onCreated(created, selectedVehicles)
      toast.success(`Requête ${created.reference ?? created.id} créée en brouillon`)
      onOpenChange(false)
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de créer la requête')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setStep(1)
    setValues({
      marketeur_org_id: defaultMarketeurOrg(),
      source_site_id: '',
      destination_site_id: '',
      requested_quantity: 0,
      type: 'VRAC',
    })
    setErrors([])
    setSelectedVehicles([])
  }

  const inputClass =
    'mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false) }}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Nouvelle requête de ramassage' : 'Sélection des véhicules'}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className='space-y-4 py-2'>
            <div className='flex gap-3'>
              <label className='block flex-1 text-sm'>
                <span>Type de cargaison</span>
                <select
                  className={inputClass}
                  value={values.type}
                  onChange={(e) => set('type', e.target.value as VehicleType)}
                >
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className='block flex-1 text-sm'>
                <span>Quantité</span>
                <input
                  type='number'
                  min={0}
                  step={values.type === 'VRAC' ? 0.5 : 1}
                  value={values.requested_quantity || ''}
                  onChange={(e) => set('requested_quantity', Number(e.target.value))}
                  placeholder={values.type === 'VRAC' ? 'TM' : 'btl'}
                  className={inputClass}
                />
              </label>
            </div>

            <label className='block text-sm'>
              <span>Marketeur</span>
              <select
                className={inputClass}
                value={values.marketeur_org_id}
                onChange={(e) => set('marketeur_org_id', e.target.value)}
              >
                {MARKET_EUR_ORGS.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>

            <label className='block text-sm'>
              <span>Site source</span>
              <select
                className={inputClass}
                value={values.source_site_id}
                onChange={(e) => {
                  set('source_site_id', e.target.value)
                  set('destination_site_id', '')
                }}
              >
                <option value=''>— Sélectionner —</option>
                {sourceOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>

            <label className='block text-sm'>
              <span>Site destination</span>
              <select
                className={inputClass}
                value={values.destination_site_id}
                onChange={(e) => set('destination_site_id', e.target.value)}
              >
                <option value=''>— Sélectionner —</option>
                {destOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>

            {errors.length > 0 && (
              <ul className='space-y-1 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'>
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className='space-y-4 py-2'>
            <p className='text-sm text-muted-foreground'>
              Véhicules <strong>{TYPE_LABELS[values.type]}</strong> du marketeur capables de
              transporter <strong>{values.requested_quantity}</strong>{' '}
              {values.type === 'VRAC' ? 'TM' : 'btl'}.
            </p>

            {recommendations.length === 0 ? (
              <div className='rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'>
                Aucun véhicule de capacité suffisante trouvé pour cette quantité.
              </div>
            ) : (
              <ul className='space-y-2'>
                {recommendations.map(({ vehicle, fitRatio, spareCapacity }) => (
                  <li key={vehicle.id}>
                    <button
                      type='button'
                      onClick={() => toggleVehicle(vehicle.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
                        selectedVehicles.includes(vehicle.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/40'
                      }`}
                    >
                      <span className='flex items-center gap-2 font-medium'>
                        <Truck className='size-4 text-primary' />
                        {vehicle.license_plate}
                      </span>
                      <span className='flex items-center gap-3 text-xs text-muted-foreground'>
                        <span>
                          Capacité {values.type === 'VRAC'
                            ? `${vehicle.max_volume} TM`
                            : `${vehicle.max_bottle_count} btl`}
                        </span>
                        <span>Reste {values.type === 'VRAC' ? `${spareCapacity} TM` : `${spareCapacity} btl`}</span>
                        <span>{Math.round(fitRatio * 100)}%</span>
                        <span
                          className={`flex size-5 items-center justify-center rounded-full border ${
                            selectedVehicles.includes(vehicle.id)
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {selectedVehicles.includes(vehicle.id) && <Check className='size-3.5' />}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            {step === 2 && (
              <Button variant='ghost' onClick={() => setStep(1)} className='gap-1'>
                <ArrowLeft className='size-4' /> Retour
              </Button>
            )}
          </div>
          <div className='flex items-center gap-2'>
            <Button variant='outline' onClick={() => onOpenChange(false)}>Annuler</Button>
            {step === 1 ? (
              <Button onClick={submit} className='gap-1'>
                Suivant <ArrowRight className='size-4' />
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting || selectedVehicles.length === 0} className='gap-1'>
                Créer la requête
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
