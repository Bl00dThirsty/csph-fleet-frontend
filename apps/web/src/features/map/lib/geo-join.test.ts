import { describe, it, expect } from 'vitest'
import { joinAnomalyGeo } from './geo-join'
import type { Anomaly } from '@lpg/types'

function anomaly(over: Partial<Anomaly> = {}): Anomaly {
  return {
    id: 'ano-1',
    type: 'VOLUMEGAP',
    category: 'INVESTIGATION',
    severity: 'ELEVE',
    status: 'NOUVEAU',
    site_id: 'site-1',
    client_site_id: null,
    entity_type: 'SITE',
    entity_id: 'site-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as Anomaly
}

const sites = [{ id: 'site-1', name: 'Dépôt Douala', longitude: 9.7, latitude: 4.05 }]
const clientSites = [{ id: 'cs-1', name: 'Client Yaoundé', longitude: 11.5, latitude: 3.87 }]

describe('joinAnomalyGeo', () => {
  it('resolves an anomaly through site_id', () => {
    const result = joinAnomalyGeo([anomaly()], sites, clientSites)
    expect(result).toHaveLength(1)
    expect(result[0]?.longitude).toBe(9.7)
    expect(result[0]?.latitude).toBe(4.05)
    expect(result[0]?.entity_label).toBe('Dépôt Douala')
  })

  it('resolves an anomaly through client_site_id', () => {
    const result = joinAnomalyGeo(
      [anomaly({ site_id: null, client_site_id: 'cs-1' })],
      sites,
      clientSites,
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.longitude).toBe(11.5)
    expect(result[0]?.entity_label).toBe('Client Yaoundé')
  })

  it('drops an anomaly that references neither a site nor a client site', () => {
    const result = joinAnomalyGeo(
      [anomaly({ site_id: null, client_site_id: null, entity_id: 'veh-9' })],
      sites,
      clientSites,
    )
    expect(result).toEqual([])
  })

  it('drops an anomaly whose referenced site is missing', () => {
    const result = joinAnomalyGeo([anomaly({ site_id: 'ghost' })], sites, clientSites)
    expect(result).toEqual([])
  })

  it('carries category, severity and status through to the view', () => {
    const result = joinAnomalyGeo([anomaly()], sites, clientSites)
    expect(result[0]?.category).toBe('INVESTIGATION')
    expect(result[0]?.severity).toBe('ELEVE')
    expect(result[0]?.status).toBe('NOUVEAU')
  })

  it('returns an empty array for no anomalies', () => {
    expect(joinAnomalyGeo([], sites, clientSites)).toEqual([])
  })
})
