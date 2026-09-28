import { curated } from '@/lib/entity-data'
import type {
  Vehicle as CuratedVehicle,
  VehicleType,
} from '@lpg/types'

export type CertificateStatus =
  | 'VALID'
  | 'EXPIRED'
  | 'EXPIRING'
  | 'MISSING'

export interface CertificateView {
  id: string
  vehicleId: string
  licensePlate: string
  certificateNumber: string
  issuedAt: string
  expiryAt: string
  status: CertificateStatus
  orgId: string
  orgName: string
  vehicleType: VehicleType
  url: string
}

const EXPIRING_WINDOW_DAYS = 30

export const CERT_STATUS_LABELS: Record<CertificateStatus, string> = {
  VALID: 'Valide',
  EXPIRED: 'ExpirÃ©',
  EXPIRING: 'Expirant',
  MISSING: 'Manquant',
}

export function certStatusLabel(status: CertificateStatus): string {
  return CERT_STATUS_LABELS[status]
}

function statusForExpiry(expiry: string): CertificateStatus {
  const expiryAt = new Date(expiry).getTime()
  if (Number.isNaN(expiryAt)) return 'MISSING'
  const now = Date.now()
  if (expiryAt < now) return 'EXPIRED'
  const windowMs = EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000
  if (expiryAt - now <= windowMs) return 'EXPIRING'
  return 'VALID'
}

export function getCertificates(): CertificateView[] {
  const vehicles = curated.vehicles as CuratedVehicle[]
  const orgById = new Map(curated.organizations.map((org) => [org.id, org.name]))

  const certificates: CertificateView[] = []
  for (const vehicle of vehicles) {
    const number = vehicle.certificate_number?.trim()
    const url = vehicle.certificate_url?.trim()
    if (!number && !url) continue

    const expiry = vehicle.certificate_expiry_at?.trim()

    certificates.push({
      id: `cert-${vehicle.id}`,
      vehicleId: vehicle.id,
      licensePlate: vehicle.license_plate,
      certificateNumber: number ?? url ?? 'â€”',
      issuedAt: vehicle.certificate_issued_at ?? 'â€”',
      expiryAt: expiry ?? 'â€”',
      status: expiry ? statusForExpiry(expiry) : 'MISSING',
      orgId: vehicle.org_id,
      orgName: orgById.get(vehicle.org_id) ?? 'â€”',
      vehicleType: vehicle.type,
      url: url ?? '',
    })
  }

  return certificates
}