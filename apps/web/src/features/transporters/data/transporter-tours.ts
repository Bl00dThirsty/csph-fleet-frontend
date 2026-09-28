import type { DeliveryTour, TransporterContract, Organization, Vehicle, Driver, Checkpoint, Site, ClientSite } from '@lpg/types'
import { format } from 'date-fns'
import { useToursStore } from '@/store/tours-store'

export type TourStatus = DeliveryTour['status']

export interface TransporterTourWithDetails extends DeliveryTour {
  marketeur?: Organization
  transporter?: Organization
  vehicle?: Vehicle
  driver?: Driver
  contract?: TransporterContract
  checkpoints?: (Checkpoint & { site?: Site; client_site?: ClientSite })[]
  progress: number
  statusLabel: string
}

function tourStatusLabel(status: DeliveryTour['status']): string {
  switch (status) {
    case 'DRAFT':
      return 'Brouillon'
    case 'PLANNED':
      return 'Planifié'
    case 'PENDINGTRANSPORTERACK':
      return 'En attente transporteur'
    case 'ACKNOWLEDGED':
      return 'Reconnu'
    case 'INPROGRESS':
      return 'En transit'
    case 'CHECKPOINTACTIVE':
      return 'En livraison'
    case 'CLOSED':
      return 'Livré'
    case 'CANCELLED':
      return 'Annulé'
    default:
      return status
  }
}

function tourProgress(status: DeliveryTour['status']): number {
  switch (status) {
    case 'DRAFT':
      return 0
    case 'PLANNED':
      return 10
    case 'PENDINGTRANSPORTERACK':
      return 20
    case 'ACKNOWLEDGED':
      return 30
    case 'INPROGRESS':
      return 50
    case 'CHECKPOINTACTIVE':
      return 80
    case 'CLOSED':
      return 100
    case 'CANCELLED':
      return 0
    default:
      return 0
  }
}

/**
 * Build a transporter tour view by enriching the raw tour row from the live
 * tours-store. `marketeur` / `transporter` / `vehicle` / `driver` come from
 * their respective stores; the previous curated.* seed has been removed.
 */
function buildTransporterTourWithDetails(tour: DeliveryTour): TransporterTourWithDetails {
  const checkpoints = useToursStore.getState().checkpoints
  const tourCheckpoints = checkpoints
    .filter((cp) => cp.tournee_id === tour.id)
    .sort((a, b) => a.sequence - b.sequence)

  return {
    ...tour,
    // Org / vehicle / driver lookups: rely on the store consumers to pass
    // these via component state — the data file no longer resolves them
    // synchronously against a curated seed.
    contract: undefined,
    checkpoints: tourCheckpoints,
    progress: tourProgress(tour.status),
    statusLabel: tourStatusLabel(tour.status),
  }
}

export function getToursForTransporter(transporterOrgId: string): TransporterTourWithDetails[] {
  return useToursStore
    .getState()
    .tours.filter((t) => t.transporter_org_id === transporterOrgId)
    .map(buildTransporterTourWithDetails)
}

export function getToursForMarketer(marketerOrgId: string): TransporterTourWithDetails[] {
  return useToursStore
    .getState()
    .tours.filter((t) => t.marketeur_org_id === marketerOrgId)
    .map(buildTransporterTourWithDetails)
}

export function getAllTransporterTours(): TransporterTourWithDetails[] {
  return useToursStore
    .getState()
    .tours.filter((t) => t.transporter_org_id != null)
    .map(buildTransporterTourWithDetails)
}

export function getTransporterTourById(id: string): TransporterTourWithDetails | undefined {
  const tour = useToursStore.getState().tours.find((t) => t.id === id)
  return tour ? buildTransporterTourWithDetails(tour) : undefined
}

// Helper functions for display
export function getTourEta(tour: DeliveryTour): string {
  if (tour.started_at) {
    const start = new Date(tour.started_at)
    const eta = new Date(start.getTime() + 4 * 3600 * 1000)
    return format(eta, 'HH:mm')
  }
  return '—'
}

export function getTourCargo(tour: DeliveryTour): string {
  return tour.type === 'VRAC' ? 'GPL vrac' : 'Bouteilles 50 kg'
}

export function getTourVolume(tour: DeliveryTour): string {
  return `${tour.requested_quantity} ${tour.type === 'VRAC' ? 'TM' : 'btl'}`
}

export function getExecutionModeLabel(mode: DeliveryTour['execution_mode']): string {
  return mode === 'INTERNAL' ? 'Interne' : 'Externe'
}