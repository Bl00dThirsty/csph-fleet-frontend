import {
  redressementStatusLabels,
  type RedressementStatus,
  type RedressementView,
} from '@/features/redressements/data/redressements'
import { getReconciliations, gapToleranceThreshold, type ReconciliationView } from '@/features/reconciliations/data/reconciliations'
import { getRedressements } from '@/features/redressements/data/redressements'

export type { RedressementStatus }

const CURRENCY = 'XAF'

function currencyLabel(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} ${CURRENCY}`
}

export function getFinanceSummary(
  reconciliationRows: readonly ReconciliationView[] = getReconciliations(),
  redressementRows: readonly RedressementView[] = getRedressements(),
  tolerance: number = gapToleranceThreshold(),
) {
  const declaredVolume = reconciliationRows.reduce((acc, r) => acc + r.declared_volume, 0)
  const totalGap = reconciliationRows.reduce((acc, r) => acc + Math.abs(r.volume_gap), 0)
  const subsidyImpact = reconciliationRows.reduce((acc, r) => acc + Math.abs(r.subsidy_impact), 0)
  const outstanding = redressementRows
    .filter((r) => r.status === 'ISSUED')
    .reduce((acc, r) => acc + r.amount, 0)
  const collected = redressementRows
    .filter((r) => r.status === 'PAID')
    .reduce((acc, r) => acc + r.amount, 0)
  const flagged = reconciliationRows.filter(
    (r) => r.gap_percentage > tolerance
  ).length

  return {
    declaredVolume,
    declaredVolumeLabel: `${declaredVolume.toLocaleString('fr-FR')} TM`,
    totalGap,
    totalGapLabel: `${totalGap.toLocaleString('fr-FR')} TM`,
    gapPercentage: declaredVolume > 0 ? (totalGap / declaredVolume) * 100 : 0,
    subsidyImpact,
    subsidyImpactLabel: currencyLabel(subsidyImpact),
    outstanding,
    outstandingLabel: currencyLabel(outstanding),
    collected,
    collectedLabel: currencyLabel(collected),
    redressementCount: redressementRows.length,
    flaggedCount: flagged,
  }
}

export interface FinanceStatusRow {
  status: RedressementStatus
  statusLabel: string
  count: number
  totalLabel: string
}

export function getRedressementStatusRows(
  rows: readonly RedressementView[] = getRedressements(),
): FinanceStatusRow[] {
  const statuses = Object.keys(redressementStatusLabels) as RedressementStatus[]
  return statuses.map((status) => {
    const subset = rows.filter((r) => r.status === status)
    return {
      status,
      statusLabel: redressementStatusLabels[status],
      count: subset.length,
      totalLabel: currencyLabel(subset.reduce((acc, r) => acc + r.amount, 0)),
    }
  })
}