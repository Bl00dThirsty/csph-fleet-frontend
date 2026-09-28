import { notification_groups, notification_rules } from '@/lib/entity-data'
import type { NotificationGroup, NotificationRule, RiskLevel } from '@lpg/types'
import type { AnomalyType } from '@lpg/types'

export type { RiskLevel, AnomalyType }

export interface AlertRuleView {
  id: string
  name: string
  anomalyType: AnomalyType | null
  minSeverity: RiskLevel | null
  targetGroupId: string
  targetGroupName: string
  isActive: boolean
  created_at?: string
  updated_at?: string
}

export const alertSeverityLabels: Record<RiskLevel, string> = {
  FAIBLE: 'Faible',
  MODERE: 'Modéré',
  ELEVE: 'Élevé',
  CRITIQUE: 'Critique',
  CRITIQUEEXTREME: 'Critique extrême',
}

export function getAlertRules(
  rules: NotificationRule[] = notification_rules as NotificationRule[],
  groups: NotificationGroup[] = notification_groups as NotificationGroup[],
): AlertRuleView[] {
  const groupNameById: Record<string, string> = Object.fromEntries(
    groups.map((group) => [group.id, group.name]),
  )
  return rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    anomalyType: rule.anomaly_type ?? null,
    minSeverity: rule.min_severity ?? null,
    targetGroupId: rule.target_group_id,
    targetGroupName: groupNameById[rule.target_group_id] ?? rule.target_group_id,
    isActive: rule.is_active,
    updatedAt: rule.updated_at ?? null,
  }))
}

export function getActiveAlertRuleCount(
  rules?: NotificationRule[],
  groups?: NotificationGroup[],
): number {
  return getAlertRules(rules, groups).filter((r) => r.isActive).length
}

export function getAnomalyTypeCount(
  rules?: NotificationRule[],
  groups?: NotificationGroup[],
): number {
  const views = getAlertRules(rules, groups)
  return new Set(views.map((r) => r.anomalyType).filter(Boolean)).size
}