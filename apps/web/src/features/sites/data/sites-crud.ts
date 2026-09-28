import { curated } from '@/lib/entity-data'
import type { ClientSite, Region, Site } from '@lpg/types'
import { field, type FieldConfig, type FormValues } from '@/components/entity-crud'

const REGION_OPTIONS: { label: string; value: string }[] = (
  ['ADAMAOUA', 'CENTRE', 'EST', 'EXTREMENORD', 'LITTORAL', 'NORD', 'NORDOUEST', 'OUEST', 'SUD', 'SUDOUEST'] as Region[]
).map((r) => ({ label: r, value: r }))

const ORG_OPTIONS = (curated.organizations as Array<{ id: string; name: string }>).map((o) => ({
  label: o.name,
  value: o.id,
}))

export const siteFields: FieldConfig[] = [
  field.text('name', 'Nom du site', { required: true }),
  field.select('org_id', 'Organisation', ORG_OPTIONS, { required: true }),
  field.select('region', 'RÃ©gion', REGION_OPTIONS, { required: true }),
  field.text('address', 'Adresse'),
  field.switchField('is_active', 'Site actif'),
]

export function siteToForm(s: Site): FormValues {
  return {
    id: s.id,
    name: s.name,
    org_id: s.org_id,
    region: s.region,
    address: s.address ?? '',
    is_active: s.is_active,
  }
}

export function siteFromForm(v: FormValues): Partial<Site> {
  return {
    name: String(v.name).trim(),
    org_id: String(v.org_id),
    region: v.region as Region,
    address: v.address ? String(v.address) : undefined,
    status: 'UNASSIGNED',
    is_active: Boolean(v.is_active),
  }
}

export const clientSiteFields: FieldConfig[] = [
  field.text('name', 'Nom du site client', { required: true }),
  field.select('client_org_id', 'Organisation cliente', ORG_OPTIONS, { required: true }),
  field.select('region', 'RÃ©gion', REGION_OPTIONS, { required: true }),
  field.text('address', 'Adresse'),
  field.switchField('is_active', 'Site actif'),
]

export function clientSiteToForm(s: ClientSite): FormValues {
  return {
    id: s.id,
    name: s.name,
    client_org_id: s.client_org_id,
    region: s.region,
    address: s.address ?? '',
    is_active: s.is_active,
  }
}

export function clientSiteFromForm(v: FormValues): Partial<ClientSite> {
  return {
    name: String(v.name).trim(),
    client_org_id: String(v.client_org_id),
    region: v.region as Region,
    address: v.address ? String(v.address) : undefined,
    is_active: Boolean(v.is_active),
  }
}
