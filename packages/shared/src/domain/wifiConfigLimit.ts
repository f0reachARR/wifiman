import type { WifiConfigStatus } from '../enums.js';
import { MAX_ACTIVE_WIFI_CONFIGS } from '../enums.js';

/**
 * アクティブな WiFi 構成数を返す (active + standby のみカウント、disabled は除く)。
 */
export function getActiveWifiConfigCount(
  configs: ReadonlyArray<{ status: WifiConfigStatus }>,
): number {
  return configs.filter((c) => c.status === 'active' || c.status === 'standby').length;
}

/**
 * 新しい WiFi 構成を追加できるかどうかを確認する。
 * active + standby の合計が MAX_ACTIVE_WIFI_CONFIGS (3) 未満の場合のみ追加可能。
 */
export function canAddWifiConfig(
  existingConfigs: ReadonlyArray<{ status: WifiConfigStatus }>,
): boolean {
  return getActiveWifiConfigCount(existingConfigs) < MAX_ACTIVE_WIFI_CONFIGS;
}

/**
 * 新しいステータスに更新しても上限を超えないかを確認する。
 * disabled → active/standby への変更時に使用する。
 */
export function canActivateWifiConfig(
  existingConfigs: ReadonlyArray<{ status: WifiConfigStatus }>,
  targetConfigId: string,
  newStatus: WifiConfigStatus,
): boolean {
  if (newStatus === 'disabled') return true;
  const othersCount = existingConfigs.filter((c) => {
    const configWithId = c as { status: WifiConfigStatus; id: string };
    return configWithId.id !== targetConfigId && (c.status === 'active' || c.status === 'standby');
  }).length;
  return othersCount < MAX_ACTIVE_WIFI_CONFIGS;
}
