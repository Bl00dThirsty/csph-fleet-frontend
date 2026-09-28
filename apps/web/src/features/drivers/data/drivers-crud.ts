import type { Driver } from '@lpg/types'
import { field, type FieldConfig, type FormValues } from '@/components/entity-crud'

/**
 * Organisation options are now loaded lazily by the host page via
 * `api.organizations.list()` and passed in via the org options argument.
 * The previous `curated.organizations` seed has been removed.
 */
export const driverFields: FieldConfig[] = [
  field.text('first_name', 'Prénom', { required: true }),
  field.text('last_name', 'Nom', { required: true }),
  field.select('org_id', 'Organisation', [], { required: true }),
  field.text('license_number', 'N° de permis'),
  field.switchField('is_active', 'Chauffeur actif'),
]

export function driverToForm(d: Driver): FormValues {
  return {
    id: d.id,
    first_name: d.first_name ?? '',
    last_name: d.last_name ?? '',
    org_id: d.org_id ?? '',
    license_number: d.license_number ?? '',
    is_active: d.is_active,
  }
}

export function driverFromForm(v: FormValues): Partial<Driver> {
  return {
    first_name: String(v.first_name ?? ''),
    last_name: String(v.last_name ?? ''),
    org_id: String(v.org_id ?? ''),
    license_number: String(v.license_number ?? ''),
    is_active: Boolean(v.is_active),
  }
}