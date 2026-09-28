import { describe, expect, it } from 'vitest'
import type { NotificationGroup, NotificationRule } from '@lpg/types'
import {
  alertSeverityLabels,
  getActiveAlertRuleCount,
  getAlertRules,
  getAnomalyTypeCount,
} from './alert-rules'

const groups: NotificationGroup[] = [
  { id: 'grp-tech', name: 'Technique', type: 'TECHNICAL', is_active: true },
  { id: 'grp-inv', name: 'Investigation', type: 'INVESTIGATION', is_active: true },
]

const rules: NotificationRule[] = [
  { id: 'rule-1', name: 'Écart de volume', anomaly_type: 'VOLUMEGAP', min_severity: 'ELEVE', target_group_id: 'grp-tech', is_active: true },
  { id: 'rule-2', name: 'Dérive GPS', anomaly_type: 'DEVIATIONROUTE', min_severity: 'MODERE', target_group_id: 'grp-tech', is_active: false },
  { id: 'rule-3', name: 'Siphonnage', anomaly_type: 'SIPHONNAGE', min_severity: 'CRITIQUE', target_group_id: 'grp-inv', is_active: true },
  { id: 'rule-4', name: 'Sans type', anomaly_type: null, min_severity: null, target_group_id: 'grp-missing', is_active: true },
]

describe('alert-rules view-model', () => {
  it('maps notification rules to alert views with resolved group names', () => {
    const views = getAlertRules(rules, groups)
    expect(views).toHaveLength(4)
    expect(views[0]).toMatchObject({
      id: 'rule-1',
      name: 'Écart de volume',
      anomalyType: 'VOLUMEGAP',
      minSeverity: 'ELEVE',
      targetGroupId: 'grp-tech',
      targetGroupName: 'Technique',
      isActive: true,
    })
    // Null anomaly/severity pass through, unknown group falls back to the id
    expect(views[3]).toMatchObject({
      anomalyType: null,
      minSeverity: null,
      targetGroupName: 'grp-missing',
    })
  })

  it('tracks active rules', () => {
    expect(getActiveAlertRuleCount(rules, groups)).toBe(3)
  })

  it('counts distinct anomaly types (ignoring nulls)', () => {
    expect(getAnomalyTypeCount(rules, groups)).toBe(3)
  })

  it('returns no rows from the empty pre-hydration collections by default', () => {
    expect(getAlertRules()).toEqual([])
    expect(getActiveAlertRuleCount()).toBe(0)
    expect(getAnomalyTypeCount()).toBe(0)
  })

  it('labels severities in French', () => {
    expect(alertSeverityLabels).toEqual({
      FAIBLE: 'Faible',
      MODERE: 'Modéré',
      ELEVE: 'Élevé',
      CRITIQUE: 'Critique',
      CRITIQUEEXTREME: 'Critique extrême',
    })
  })
})
