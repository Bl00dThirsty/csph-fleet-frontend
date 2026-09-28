import { getSettingNumber } from '@lpg/mock-data'
import { type DeviceType, type DeviceStatus } from '@lpg/types'

export type { DeviceType, DeviceStatus }

export interface DeviceHealthView {
  id: string
  serial: string
  type: DeviceType
  typeLabel: string
  status: DeviceStatus
  issue: string
  battery: number | null
  lastSync: string | null
}

export const deviceHealthTypeLabels: Record<DeviceType, string> = {
  GPS: 'GPS',
  PDA: 'PDA',
  RFIDREADER: 'Lecteur RFID',
}

/**
 * device-health — stubbed. Live rows arrive via api.devices.list(). Until
 * that store hydrates, `getDeviceHealth()` returns an empty list and the
 * page shows a "no attention devices" message.
 */
export function getDeviceHealth(): DeviceHealthView[] {
  return []
}

export function getDeviceHealthSummary() {
  // batteryCriticalThreshold is no longer used here — kept as a no-op until
  // live device rows arrive and the real threshold is consulted per-device.
  const _threshold = getSettingNumber('device.battery_critical_threshold')
  void _threshold
  return {
    total: 0,
    attention: 0,
    offline: 0,
    batteryCritical: 0,
    operational: 0,
  }
}