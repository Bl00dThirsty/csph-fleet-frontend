import { describe, expect, it } from 'vitest'
import {
  formatFileSize,
  getReportSummary,
  getReports,
  reportStatusLabels,
  reportTypeLabels,
} from './reports'
import type { AppUser, Report } from '@lpg/types'

const users: AppUser[] = [
  {
    id: 'user-1',
    email: 'agent.test@example.cm',
    first_name: 'Agent',
    last_name: 'Test',
    system_role: 'AGENT',
    org_id: 'org-a',
    is_active: true,
  },
]

function report(partial: Partial<Report> & Pick<Report, 'id' | 'name' | 'type' | 'status'>): Report {
  return {
    format: 'PDF',
    parameters_json: {},
    ...partial,
  }
}

const source: Report[] = [
  report({ id: 'rep-1', name: 'Rapport opérationnel', type: 'OPERATIONAL', status: 'READY', generated_by: 'user-1', file_size: 2048 }),
  report({ id: 'rep-2', name: 'Rapport financier', type: 'FINANCIAL', status: 'PENDING' }),
  report({ id: 'rep-3', name: 'Rapport conformité', type: 'COMPLIANCE', status: 'GENERATING' }),
  report({ id: 'rep-4', name: 'Rapport en échec', type: 'OPERATIONAL', status: 'FAILED', generated_by: 'user-unknown' }),
]

describe('reports view-model', () => {
  it('maps reports with labels', () => {
    const rows = getReports(source, users)
    expect(rows).toHaveLength(4)
    for (const row of rows) {
      expect(row.name).toBeTruthy()
      expect(reportTypeLabels[row.type]).toBe(row.typeLabel)
      expect(reportStatusLabels[row.status]).toBe(row.statusLabel)
    }
    // Generator names resolve from the user rows, unknown ids pass through.
    expect(rows.find((r) => r.id === 'rep-1')?.generatedBy).toBe('Agent Test')
    expect(rows.find((r) => r.id === 'rep-4')?.generatedBy).toBe('user-unknown')
    expect(rows.find((r) => r.id === 'rep-2')?.generatedBy).toBeNull()
  })

  it('computes status summary', () => {
    const rows = getReports(source, users)
    const summary = getReportSummary(rows)
    expect(summary.total).toBe(rows.length)
    expect(summary).toEqual({ total: 4, ready: 1, pending: 2, failed: 1 })
  })

  it('defaults to the live entity collections', () => {
    expect(getReports()).toEqual([])
    expect(getReportSummary()).toEqual({ total: 0, ready: 0, pending: 0, failed: 0 })
  })

  it('formats file sizes', () => {
    expect(formatFileSize(null)).toBe('')
    expect(formatFileSize(512)).toBe('512 o')
    expect(formatFileSize(2048)).toBe('2.0 Ko')
  })
})
