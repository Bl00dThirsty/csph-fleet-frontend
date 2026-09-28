import { useEffect, useMemo, useState } from 'react'
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
import {
  buildCheckpointPayload,
  extractUserRoleCodes,
  nextCheckpointSequence,
  toRequestedQuantity,
  type CheckpointDraftRow,
} from '../lib/tour-create-helpers'

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

interface CandidateUser {
  id: string
  first_name?: string
  last_name?: string
  license_number?: string
}

interface SiteOption {
  id: string
  name: string
}

/* ── 3.6 — Detail-role cache ──────────────────────────────────────────────
 * The user-LIST projection carries no roles (every row falls back to
 * LIVREUR), so DRIVER membership is resolved once per user via
 * GET /users/{id} and cached here (module-level: shared across dialog
 * opens, 5 min TTL) instead of refetching on every open. */
const DRIVER_ROLE_CACHE_TTL_MS = 5 * 60 * 1000
const roleCodesCache = new Map<string, { codes: string[]; at: number }>()

function getCachedRoleCodes(id: string): string[] | undefined {
  const entry = roleCodesCache.get(id)
  if (!entry) return undefined
  if (Date.now() - entry.at > DRIVER_ROLE_CACHE_TTL_MS) {
    roleCodesCache.delete(id)
    return undefined
  }
  return entry.codes
}

async function resolveRoleCodesBatched(
  ids: string[],
  isCancelled: () => boolean,
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  const BATCH_SIZE = 8
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    if (isCancelled()) break
    const batch = ids.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const detail = await api.users.getById(id)
          const codes = extractUserRoleCodes(detail)
          roleCodesCache.set(id, { codes, at: Date.now() })
          return { id, codes }
        } catch {
          // No invention on failure: the row keeps its list-level fallback
          // (LIVREUR) and is simply not offered as a chauffeur.
          return { id, codes: null as string[] | null }
        }
      }),
    )
    for (const r of results) {
      if (r.codes) out[r.id] = r.codes
    }
  }
  return out
}

function toSiteOptions(rows: unknown): SiteOption[] {
  if (!Array.isArray(rows)) return []
  const out: SiteOption[] = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = String(o['id'] ?? '')
    if (!id) continue
    out.push({ id, name: String(o['name'] ?? o['siteName'] ?? o['displayName'] ?? id) })
  }
  return out
}

export function TourCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: TourCreateDialogProps) {
  // tourCode starts blank: it is @NotBlank server-side and must come from the
  // operator. The old random `TRP-XXXX` default silently filed invented codes.
  const [tourCode, setTourCode] = useState('')
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
  const [candidates, setCandidates] = useState<CandidateUser[]>([])
  const [roleCodesById, setRoleCodesById] = useState<Record<string, string[]>>({})
  const [rolesResolving, setRolesResolving] = useState(false)
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([])
  const [clientSiteOptions, setClientSiteOptions] = useState<SiteOption[]>([])
  const [dataError, setDataError] = useState<string | null>(null)

  // 3.7 — Checkpoint picker: destination + operator sequence + planned qty.
  const [checkpointRows, setCheckpointRows] = useState<CheckpointDraftRow[]>([])
  const [checkpointError, setCheckpointError] = useState<string | null>(null)
  const [createdTourId, setCreatedTourId] = useState<string | null>(null)
  const [createdTourCode, setCreatedTourCode] = useState<string | null>(null)
  const [savedCheckpointCount, setSavedCheckpointCount] = useState(0)

  // 3.6 — Resolved from the detail projection (GET /users/{id} → roles).
  // DRIVER is its own backend role, distinct from LIVREUR: the chauffeur
  // dropdown only ever lists detail-confirmed DRIVER rows. The livreur
  // dropdown lists detail-confirmed LIVREUR rows plus rows whose roles
  // could not be resolved (adapter fallback convention).
  const drivers = useMemo(
    () => candidates.filter((c) => (roleCodesById[c.id] ?? []).includes('DRIVER')),
    [candidates, roleCodesById],
  )
  const livreurs = useMemo(
    () =>
      candidates.filter((c) => {
        const codes = roleCodesById[c.id] ?? []
        return codes.includes('LIVREUR') || codes.length === 0
      }),
    [candidates, roleCodesById],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setDataError(null)
    setCheckpointError(null)
    setCreatedTourId(null)
    setCreatedTourCode(null)
    setSavedCheckpointCount(0)
    setRolesResolving(false)
    ;(async () => {
      try {
        const [orgRes, vehRes, usrRes, siteRes, csRes] = await Promise.all([
          api.organizations.list({ size: 200 }),
          api.vehicles.list({ size: 200 }),
          api.users.list({ size: 200 }),
          api.sites.list({ size: 200 }),
          api.clientSites.list({ size: 200 }),
        ])
        if (cancelled) return
        setOrgs(((orgRes.data ?? []) as unknown) as OrgOption[])
        setVehicles(((vehRes.data ?? []) as unknown) as VehicleOption[])
        const rows = (((usrRes.data ?? []) as unknown[]) || []).filter(
          (u): u is CandidateUser =>
            !!u && typeof u === 'object' && typeof (u as CandidateUser).id === 'string',
        )
        setCandidates(rows)
        setSiteOptions(toSiteOptions(siteRes.data))
        setClientSiteOptions(toSiteOptions(csRes.data))

        // Defaults: pick the first matching option if the user hasn't set one.
        setMarketerId((current) =>
          current || ((orgRes.data ?? []) as OrgOption[]).find((o) => o.type === 'MARKETEUR')?.id || '',
        )
        setTransporterId((current) =>
          current || ((orgRes.data ?? []) as OrgOption[]).find((o) => o.type === 'TRANSPORTEUR')?.id || '',
        )
        setVehicleId((current) => current || '')

        // 3.6 — the list projection carries no roles: seed from the cache /
        // list-level codes, then resolve the rest via GET /users/{id}.
        const base: Record<string, string[]> = {}
        const needsDetail: string[] = []
        for (const u of rows) {
          const cached = getCachedRoleCodes(u.id)
          if (cached) {
            base[u.id] = cached
            continue
          }
          const fromList = extractUserRoleCodes(u)
          if (fromList.length > 0) base[u.id] = fromList
          else needsDetail.push(u.id)
        }
        setRoleCodesById(base)
        if (needsDetail.length === 0 || cancelled) return
        setRolesResolving(true)
        const resolved = await resolveRoleCodesBatched(needsDetail, () => cancelled)
        if (cancelled) return
        setRoleCodesById((prev) => ({ ...prev, ...resolved }))
        setRolesResolving(false)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Erreur réseau — listes indisponibles.'
        setDataError(message)
        setRolesResolving(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  // Default chauffeur / livreur to the first resolved option.
  useEffect(() => {
    if (driverId === '' && drivers.length > 0 && drivers[0]) {
      setDriverId(drivers[0].id)
    }
  }, [drivers, driverId])
  useEffect(() => {
    if (livreurId === '' && livreurs.length > 0 && livreurs[0]) {
      setLivreurId(livreurs[0].id)
    }
  }, [livreurs, livreurId])

  const availableVehicles = vehicles.filter((v) => v.type === cargoType)
  const availableMarketers = orgs.filter((o) => o.type === 'MARKETEUR')
  const availableTransporters = orgs.filter((o) => o.type === 'TRANSPORTEUR')
  const quantityUnit = cargoType === 'VRAC' ? 'TM' : 'btl'
  const plannedTotal = checkpointRows.reduce(
    (sum, r) => sum + (Number.isFinite(Number(r.plannedQuantity)) ? Number(r.plannedQuantity) : 0),
    0,
  )

  function addCheckpointRow() {
    setCheckpointRows((prev) => [
      ...prev,
      {
        kind: 'CLIENT_SITE',
        destinationId: '',
        sequence: nextCheckpointSequence(prev),
        plannedQuantity: 0,
      },
    ])
  }

  function updateCheckpointRow(index: number, patch: Partial<CheckpointDraftRow>) {
    setCheckpointRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function removeCheckpointRow(index: number) {
    setCheckpointRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setCheckpointError(null)
    try {
      // 3.5 — TM/btl pass-through: the dialog enters TM, the backend
      // expects TM. delivered_quantity feeds the subsidy reconciliation
      // and must never be scaled.
      let tourId = createdTourId
      let code = createdTourCode ?? tourCode.trim()
      if (!tourId) {
        const draft: TourDraft = {
          tour_code: tourCode.trim(),
          marketeur_org_id: marketerId,
          execution_mode: executionMode,
          type: cargoType,
          requested_quantity: toRequestedQuantity(quantity),
          transporter_org_id: executionMode === 'EXTERNAL' ? transporterId : null,
          vehicle_id: executionMode === 'INTERNAL' ? vehicleId || null : null,
          driver_id: executionMode === 'INTERNAL' ? driverId || null : null,
          livreur_user_id: executionMode === 'INTERNAL' ? livreurId || null : null,
        }

        const created = await useToursStore.getState().createTourAsync(draft)
        tourId = created.id
        code = created.reference ?? code
        setCreatedTourId(tourId)
        setCreatedTourCode(code)
      }

      // 3.7 — Serial checkpoint submit (UNIQUE(tournee_id, sequence)):
      // stop at the first failure, surface it, keep the dialog open so the
      // operator can fix the row and retry (already-saved rows are skipped).
      let saved = savedCheckpointCount
      for (let i = savedCheckpointCount; i < checkpointRows.length; i++) {
        const row = checkpointRows[i]
        if (!row) continue
        let payload
        try {
          payload = buildCheckpointPayload(row)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Point invalide.'
          setCheckpointError(message)
          toast.error(message)
          return
        }
        try {
          await api.tours.addCheckpoint(tourId, payload)
          saved = i + 1
          setSavedCheckpointCount(saved)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erreur réseau.'
          const detail = `Point n°${row.sequence} non enregistré — arrêt à la première erreur : ${message}`
          setCheckpointError(detail)
          toast.error(detail)
          return
        }
      }

      const suffix =
        checkpointRows.length > 0 ? ` — ${saved}/${checkpointRows.length} point(s) enregistré(s)` : ''
      toast.success(`Tournée ${code} créée en base${suffix}`)
      setCheckpointRows([])
      setCheckpointError(null)
      setCreatedTourId(null)
      setCreatedTourCode(null)
      setSavedCheckpointCount(0)
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
      <DialogContent className='sm:max-w-2xl'>
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

          {createdTourId && (
            <div className='my-3 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-800 dark:text-sky-200'>
              Tournée {createdTourCode} créée — {savedCheckpointCount}/{checkpointRows.length} point(s) enregistré(s).
              Corrigez le point en erreur puis validez à nouveau (les points déjà enregistrés ne sont pas renvoyés).
            </div>
          )}

          {checkpointError && (
            <div className='my-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300'>
              {checkpointError}
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
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {rolesResolving
                        ? 'Résolution des rôles chauffeurs…'
                        : drivers.length === 0
                          ? 'Aucun chauffeur (rôle DRIVER) détecté parmi les utilisateurs.'
                          : `${drivers.length} chauffeur(s) — rôle DRIVER vérifié.`}
                    </p>
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

            {/* 3.7 — Points de passage */}
            <div className='rounded-md border border-input p-3'>
              <div className='mb-2 flex items-center justify-between gap-2'>
                <span className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                  Points de passage (optionnel)
                </span>
                <Button type='button' variant='outline' onClick={addCheckpointRow} disabled={submitting}>
                  Ajouter un point
                </Button>
              </div>
              {checkpointRows.length === 0 ? (
                <p className='text-xs text-muted-foreground'>
                  Aucun point pour l'instant — la tournée sera créée sans escale, ou ajoutez des arrêts
                  (destination + séquence + quantité prévue) enregistrés dans l'ordre après création.
                </p>
              ) : (
                <div className='grid gap-2'>
                  {checkpointRows.map((row, i) => {
                    const options = row.kind === 'SITE' ? siteOptions : clientSiteOptions
                    const saved = i < savedCheckpointCount
                    return (
                      <div key={i} className='grid grid-cols-[1fr_4.5rem_5.5rem_2rem] items-end gap-2'>
                        <div>
                          <label className='block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
                            Destination
                          </label>
                          <select
                            value={row.kind}
                            onChange={(e) =>
                              updateCheckpointRow(i, {
                                kind: e.target.value as CheckpointDraftRow['kind'],
                                destinationId: '',
                              })
                            }
                            disabled={submitting || saved}
                            className='mb-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs shadow-sm'
                          >
                            <option value='CLIENT_SITE'>Site client</option>
                            <option value='SITE'>Site interne</option>
                          </select>
                          <select
                            value={row.destinationId}
                            onChange={(e) => updateCheckpointRow(i, { destinationId: e.target.value })}
                            disabled={submitting || saved}
                            className='w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs shadow-sm'
                          >
                            <option value=''>— Sélectionner —</option>
                            {options.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className='block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
                            Séquence
                          </label>
                          <input
                            type='number'
                            min={1}
                            step={1}
                            required
                            value={row.sequence}
                            onChange={(e) => updateCheckpointRow(i, { sequence: Number(e.target.value) })}
                            disabled={submitting || saved}
                            className='w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs shadow-sm'
                          />
                        </div>
                        <div>
                          <label className='block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1'>
                            Qté prévue ({quantityUnit})
                          </label>
                          <input
                            type='number'
                            min={0}
                            step={cargoType === 'VRAC' ? '0.1' : '1'}
                            value={row.plannedQuantity}
                            onChange={(e) => updateCheckpointRow(i, { plannedQuantity: Number(e.target.value) })}
                            disabled={submitting || saved}
                            className='w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs shadow-sm'
                          />
                        </div>
                        <div className='pb-0.5'>
                          <Button
                            type='button'
                            variant='outline'
                            onClick={() => removeCheckpointRow(i)}
                            disabled={submitting || saved}
                            aria-label={`Retirer le point ${i + 1}`}
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  <p className='text-xs text-muted-foreground'>
                    Total planifié : {plannedTotal.toLocaleString('fr-FR')} {quantityUnit} pour{' '}
                    {Number(quantity).toLocaleString('fr-FR')} {quantityUnit} demandés.
                    La quantité est indicative (le backend ne stocke aucune quantité par point) ;
                    seuls destination et séquence sont transmis, dans l'ordre, un par un.
                  </p>
                </div>
              )}
            </div>
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
            <Button type='submit' disabled={submitting || (!createdTourId && !marketerId)}>
              {submitting ? 'Création...' : createdTourId ? 'Réessayer les points restants' : 'Créer la tournée'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
