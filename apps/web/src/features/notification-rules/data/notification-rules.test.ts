import { describe, expect, it } from 'vitest'
import type { NotificationGroup, NotificationRule } from '@lpg/types'
import {
  getNotifActiveRuleCount,
  getNotifRuleCount,
  getNotifRoutingGroups,
  routingSeverityLabels,
} from './notification-rules'

const groups: NotificationGroup[] = [
  { id: 'g-tech', name: 'Technique', type: 'TECHNICAL', is_active: true },
  { id: 'g-inv', name: 'Investigation', type: 'INVESTIGATION', is_active: true },
]

const rules: NotificationRule[] = [
  {
    id: 'r1',
    name: 'Écart de volume',
    anomaly_type: 'VOLUMEGAP',
    min_severity: 'ELEVE',
    target_group_id: 'g-tech',
    is_active: true,
  },
  {
    id: 'r2',
    name: 'Panne GPS',
    anomaly_type: 'GPSFAILURE',
    min_severity: 'CRITIQUE',
    target_group_id: 'g-tech',
    is_active: false,
  },
  {
    id: 'r3',
    name: 'Toutes anomalies',
    anomaly_type: null,
    min_severity: null,
    target_group_id: 'g-inv',
    is_active: true,
  },
]

describe('notification-rules routing view-model', () => {
  it('routes every rule to a target group', () => {
    const routed = getNotifRoutingGroups(rules, groups)
    const total = routed.reduce((acc, g) => acc + g.ruleCount, 0)
    expect(total).toBe(getNotifRuleCount(rules))
    expect(total).toBe(3)
    expect(routed.find((g) => g.targetGroupId === 'g-tech')?.targetGroupName).toBe(
      'Technique',
    )
  })

  it('tracks active rule counts across groups', () => {
    expect(getNotifActiveRuleCount(rules, groups)).toBe(2)
    const tech = getNotifRoutingGroups(rules, groups).find(
      (g) => g.targetGroupId === 'g-tech',
    )
    expect(tech?.ruleCount).toBe(2)
    expect(tech?.activeRuleCount).toBe(1)
  })

  it('falls back to the group id when the group is unknown', () => {
    const orphan: NotificationRule[] = [
      {
        id: 'r-x',
        name: 'Orpheline',
        anomaly_type: 'VOLUMEGAP',
        min_severity: 'FAIBLE',
        target_group_id: 'g-missing',
        is_active: true,
      },
    ]
    const routed = getNotifRoutingGroups(orphan, groups)
    expect(routed[0]?.targetGroupName).toBe('g-missing')
  })

  it('defaults to the (empty) entity-data collections', () => {
    expect(getNotifRoutingGroups()).toEqual([])
    expect(getNotifRuleCount()).toBe(0)
    expect(getNotifActiveRuleCount()).toBe(0)
  })

  it('labels severity thresholds', () => {
    expect(routingSeverityLabels.CRITIQUE).toBe('Critique')
    expect(routingSeverityLabels.MODERE).toBe('Modéré')
    expect(routingSeverityLabels.ELEVE).toBe('Élevé')
  })
})
