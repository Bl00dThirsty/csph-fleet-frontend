import { notification_groups, notification_rules } from '@/lib/entity-data'
import type { NotificationGroup, NotificationRule, RiskLevel } from '@lpg/types'
import type { AnomalyType } from '@lpg/types'

export type { RiskLevel, AnomalyType }

export interface NotifRuleView {
  id: string
  anomalyType: AnomalyType | null
  minSeverity: RiskLevel | null
  targetGroupId: string
  targetGroupName: string
  isActive: boolean
}

export interface NotifRoutingGroup {
  targetGroupId: string
  targetGroupName: string
  ruleCount: number
  activeRuleCount: number
  rules: NotifRoutingRuleRow[]
}

export interface NotifRoutingRuleRow {
  id: string
  name: string
  anomalyType: AnomalyType | null
  minSeverity: RiskLevel | null
  isActive: boolean
}

export const routingSeverityLabels: Record<RiskLevel, string> = {
  FAIBLE: 'Faible',
  MODERE: 'Modéré',
  ELEVE: 'Élevé',
  CRITIQUE: 'Critique',
  CRITIQUEEXTREME: 'Critique extrême',
}

export function getNotifRoutingGroups(
  rules: NotificationRule[] = notification_rules as NotificationRule[],
  groups: NotificationGroup[] = notification_groups as NotificationGroup[],
): NotifRoutingGroup[] {
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]))

  const byGroup = new Map<string, NotifRoutingRuleRow[]>()
  for (const rule of rules) {
    const key = rule.target_group_id
    if (!byGroup.has(key)) byGroup.set(key, [])
    byGroup.get(key)!.push({
      id: rule.id,
      name: rule.name,
      anomalyType: rule.anomaly_type ?? null,
      minSeverity: rule.min_severity ?? null,
      isActive: rule.is_active,
    })
  }

  return Array.from(byGroup.entries()).map(([groupId, ruleRows]) => ({
    targetGroupId: groupId,
    targetGroupName: groupNameById.get(groupId) ?? groupId,
    ruleCount: ruleRows.length,
    activeRuleCount: ruleRows.filter((r) => r.isActive).length,
    rules: ruleRows,
  }))
}

export function getNotifRuleCount(
  rows: NotificationRule[] = notification_rules as NotificationRule[],
): number {
  return rows.length
}

export function getNotifActiveRuleCount(
  rules: NotificationRule[] = notification_rules as NotificationRule[],
  groups: NotificationGroup[] = notification_groups as NotificationGroup[],
): number {
  return getNotifRoutingGroups(rules, groups).reduce((acc, g) => acc + g.activeRuleCount, 0)
}