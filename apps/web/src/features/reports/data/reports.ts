import { curated, reports } from '@/lib/entity-data'
import type { AppUser, Report, ReportFormat, ReportStatus, ReportType } from '@lpg/types'

export type { ReportFormat, ReportStatus, ReportType }

export interface ReportView {
  id: string
  name: string
  type: ReportType
  typeLabel: string
  format: ReportFormat
  status: ReportStatus
  statusLabel: string
  generatedAt: string | null
  generatedBy: string | null
  expiresAt: string | null
  fileSize: number | null
}

export const reportTypeLabels: Record<ReportType, string> = {
  OPERATIONAL: 'OpÃ©rationnel',
  FINANCIAL: 'Financier',
  COMPLIANCE: 'ConformitÃ©',
}

export const reportStatusLabels: Record<ReportStatus, string> = {
  PENDING: 'En attente',
  GENERATING: 'GÃ©nÃ©ration en cours',
  READY: 'PrÃªt',
  FAILED: 'Ã‰chec',
  EXPIRED: 'ExpirÃ©',
}

function userNameById(users: readonly AppUser[]): Record<string, string> {
  return Object.fromEntries(
    users.map((u) => [u.id, `${u.first_name} ${u.last_name}`.trim()]),
  )
}

export function getReports(
  source: readonly Report[] = reports,
  users: readonly AppUser[] = curated.users,
): ReportView[] {
  const names = userNameById(users)
  return (source as Report[]).map((report) => ({
    id: report.id,
    name: report.name,
    type: report.type,
    typeLabel: reportTypeLabels[report.type],
    format: report.format,
    status: report.status,
    statusLabel: reportStatusLabels[report.status],
    generatedAt: report.generated_at ?? null,
    generatedBy: report.generated_by ? (names[report.generated_by] ?? report.generated_by) : null,
    expiresAt: report.expires_at ?? null,
    fileSize: report.file_size ?? null,
  }))
}

export function getReportSummary(rows: ReportView[] = getReports()) {
  return {
    total: rows.length,
    ready: countByStatus(rows, 'READY'),
    pending: countByStatus(rows, 'PENDING') + countByStatus(rows, 'GENERATING'),
    failed: countByStatus(rows, 'FAILED'),
  }
}

function countByStatus(rows: readonly ReportView[], status: ReportStatus): number {
  return rows.filter((r) => r.status === status).length
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}