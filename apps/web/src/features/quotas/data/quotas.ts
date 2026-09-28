import { delivery_tours, declarations, organizations } from '@/lib/entity-data'
import type { Declaration, DeliveryTour, Organization } from '@lpg/types'

export interface MarketeurQuotaView {
  marketeurId: string
  marketeurName: string
  declaredVolume: number
  deliveredVolume: number
  usageRate: number
}

function orgName(id: string, orgs: readonly Organization[] = organizations): string {
  return orgs.find((o) => o.id === id)?.name ?? id
}

function pct(used: number, allocated: number): number {
  return allocated > 0 ? Math.round((used / allocated) * 100) : 0
}

export function getMarketeurQuotas(
  decl: readonly Declaration[] = declarations,
  tours: readonly DeliveryTour[] = delivery_tours,
  orgs: readonly Organization[] = organizations,
): MarketeurQuotaView[] {
  const ids = Array.from(new Set(decl.map((d) => d.marketeur_org_id)))

  return ids.map((id) => {
    const declaredVolume = decl
      .filter((d) => d.marketeur_org_id === id)
      .reduce((acc, d) => acc + d.declared_volume, 0)
    const deliveredVolume = tours
      .filter((t) => t.marketeur_org_id === id)
      .reduce((acc, t) => acc + (t.delivered_quantity ?? 0), 0)
    return {
      marketeurId: id,
      marketeurName: orgName(id, orgs),
      declaredVolume,
      deliveredVolume,
      usageRate: pct(deliveredVolume, declaredVolume),
    }
  })
}

export function getQuotaSummary(rows: MarketeurQuotaView[] = getMarketeurQuotas()) {
  return {
    marketeurs: rows.length,
    declared: rows.reduce((acc, r) => acc + r.declaredVolume, 0),
    delivered: rows.reduce((acc, r) => acc + r.deliveredVolume, 0),
    avgUsage: pct(
      rows.reduce((acc, r) => acc + r.deliveredVolume, 0),
      rows.reduce((acc, r) => acc + r.declaredVolume, 0),
    ),
  }
}