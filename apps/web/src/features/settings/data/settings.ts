import { settings } from '@/lib/entity-data'
import type { Setting } from '@lpg/types'

export type { Setting }

export interface SettingView {
  key: string
  value: string
  valueType: string
  category: string
  categoryLabel: string
  description: string
  isEncrypted: boolean
  requiresRestart: boolean
}

export const settingCategoryLabels: Record<string, string> = {
  GEO: 'Géolocalisation',
  DEVICE: 'Dispositifs',
  COMPLIANCE: 'Conformité',
  TOURNEE: 'Tournées',
  AUDIT: 'Audit',
  SECURITY: 'Sécurité',
  GPS: 'GPS',
  REPORT: 'Rapports',
}

export function getSettings(rows: Setting[] = settings as Setting[]): SettingView[] {
  return (rows as Setting[]).map((setting) => ({
    key: setting.setting_key,
    value: String(setting.setting_value),
    valueType: setting.value_type,
    category: setting.category,
    categoryLabel: settingCategoryLabels[setting.category] ?? setting.category,
    description: setting.description ?? '',
    isEncrypted: setting.is_encrypted,
    requiresRestart: setting.requires_restart,
  }))
}

export function getSettingSummary(rows: Setting[] = settings as Setting[]) {
  const views = getSettings(rows)
  const categories = new Set(views.map((r) => r.categoryLabel))
  return {
    total: views.length,
    encrypted: views.filter((r) => r.isEncrypted).length,
    categories: categories.size,
  }
}

export function getSettingsByCategory(
  rows: Setting[] = settings as Setting[],
): Record<string, SettingView[]> {
  const views = getSettings(rows)
  const grouped: Record<string, SettingView[]> = {}
  for (const row of views) {
    const key = row.categoryLabel
    grouped[key] = grouped[key] ?? []
    grouped[key].push(row)
  }
  return grouped
}