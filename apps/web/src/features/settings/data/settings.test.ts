import { describe, expect, it } from 'vitest'
import type { Setting } from '@lpg/types'
import {
  getSettings,
  getSettingsByCategory,
  getSettingSummary,
  settingCategoryLabels,
} from './settings'

const rows: Setting[] = [
  {
    id: 's1',
    setting_key: 'geo.confidence_min',
    setting_value: '0.8',
    value_type: 'number',
    category: 'GEO',
    description: 'Seuil de confiance',
    is_encrypted: false,
    requires_restart: false,
  },
  {
    id: 's2',
    setting_key: 'device.battery_critical_threshold',
    setting_value: '15',
    value_type: 'number',
    category: 'DEVICE',
    description: null,
    is_encrypted: false,
    requires_restart: true,
  },
  {
    id: 's3',
    setting_key: 'audit.retention_years',
    setting_value: '5',
    value_type: 'number',
    category: 'AUDIT',
    is_encrypted: true,
    requires_restart: false,
  },
]

describe('settings view-model', () => {
  it('maps settings with category labels', () => {
    const views = getSettings(rows)
    expect(views).toHaveLength(3)
    for (const row of views) {
      expect(row.key).toBeTruthy()
      expect(row.categoryLabel).toBeTruthy()
      expect(typeof row.value).toBe('string')
    }
    expect(views.find((v) => v.key === 'geo.confidence_min')?.categoryLabel).toBe(
      'Géolocalisation',
    )
    expect(views.find((v) => v.key === 'audit.retention_years')?.isEncrypted).toBe(true)
  })

  it('groups settings by category', () => {
    const grouped = getSettingsByCategory(rows)
    const total = Object.values(grouped).reduce((acc, list) => acc + list.length, 0)
    expect(total).toBe(getSettings(rows).length)
    expect(Object.keys(grouped)).toHaveLength(3)
    expect(grouped['Géolocalisation']).toHaveLength(1)
  })

  it('computes summary', () => {
    const summary = getSettingSummary(rows)
    expect(summary.total).toBe(getSettings(rows).length)
    expect(summary.total).toBe(3)
    expect(summary.encrypted).toBe(1)
    expect(summary.categories).toBe(3)
  })

  it('defaults to the (empty) entity-data collections', () => {
    expect(getSettings()).toEqual([])
    expect(getSettingSummary().total).toBe(0)
    expect(getSettingsByCategory()).toEqual({})
  })

  it('labels known categories in French', () => {
    expect(settingCategoryLabels.GEO).toBe('Géolocalisation')
    expect(settingCategoryLabels.TOURNEE).toBe('Tournées')
    expect(settingCategoryLabels.SECURITY).toBe('Sécurité')
  })
})
