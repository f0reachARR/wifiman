// 周波数帯
export const BANDS = ['2.4GHz', '5GHz', '6GHz'] as const;
export type Band = (typeof BANDS)[number];

// WiFi 構成用途
export const PURPOSES = ['control', 'video', 'debug', 'other'] as const;
export type Purpose = (typeof PURPOSES)[number];

// チャンネル幅 (MHz)
export const CHANNEL_WIDTHS = [20, 40, 80, 160] as const;
export type ChannelWidth = (typeof CHANNEL_WIDTHS)[number];

// WiFi 構成ロール
export const WIFI_CONFIG_ROLES = ['primary', 'backup'] as const;
export type WifiConfigRole = (typeof WIFI_CONFIG_ROLES)[number];

// WiFi 構成状態
export const WIFI_CONFIG_STATUSES = ['active', 'standby', 'disabled'] as const;
export type WifiConfigStatus = (typeof WIFI_CONFIG_STATUSES)[number];

// 機材種別
export const DEVICE_KINDS = ['ap', 'client', 'usb_dongle', 'router', 'bridge', 'other'] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

// 症状
export const SYMPTOMS = [
  'cannot_connect',
  'unstable',
  'low_throughput',
  'high_latency',
  'disconnect',
  'distance_sensitive',
  'unknown',
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

// 深刻度
export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

// 不具合報告の公開範囲
export const ISSUE_REPORT_VISIBILITIES = ['team_private', 'team_public'] as const;
export type IssueReportVisibility = (typeof ISSUE_REPORT_VISIBILITIES)[number];

// 距離カテゴリ
export const DISTANCE_CATEGORIES = ['near', 'mid', 'far', 'obstacle'] as const;
export type DistanceCategory = (typeof DISTANCE_CATEGORIES)[number];

// 再現性
export const REPRODUCIBILITIES = ['always', 'sometimes', 'once'] as const;
export type Reproducibility = (typeof REPRODUCIBILITIES)[number];

// 対処内容
export const MITIGATIONS = [
  'change_channel',
  'change_width',
  'change_band',
  'change_device',
  'move_position',
  'none',
] as const;
export type Mitigation = (typeof MITIGATIONS)[number];

// 野良 WiFi ソース
export const OBSERVED_WIFI_SOURCES = ['wild', 'analyzer_import', 'manual'] as const;
export type ObservedWifiSource = (typeof OBSERVED_WIFI_SOURCES)[number];

// ベストプラクティス スコープ
export const BEST_PRACTICE_SCOPES = ['general', 'tournament', 'band', 'device'] as const;
export type BestPracticeScope = (typeof BEST_PRACTICE_SCOPES)[number];

// お知らせ深刻度
export const NOTICE_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type NoticeSeverity = (typeof NOTICE_SEVERITIES)[number];

// 同期アクション
export const SYNC_ACTIONS = ['create', 'update', 'delete'] as const;
export type SyncAction = (typeof SYNC_ACTIONS)[number];

// 同期レコードステータス
export const SYNC_RECORD_STATUSES = [
  'pending',
  'processing',
  'failed',
  'conflict',
  'done',
] as const;
export type SyncRecordStatus = (typeof SYNC_RECORD_STATUSES)[number];

// チームアクセスロール
export const TEAM_ACCESS_ROLES = ['editor', 'viewer'] as const;
export type TeamAccessRole = (typeof TEAM_ACCESS_ROLES)[number];

// WiFi 構成最大件数
export const MAX_ACTIVE_WIFI_CONFIGS = 3;
