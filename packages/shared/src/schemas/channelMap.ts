import { z } from 'zod';
import {
  BANDS,
  OBSERVED_WIFI_SOURCES,
  PURPOSES,
  WIFI_CONFIG_ROLES,
  WIFI_CONFIG_STATUSES,
} from '../enums.js';
import { optionalFromNullable } from './common.js';

// ChannelMapEntry の表示元区分 (spec §3.9 sourceType)
export const CHANNEL_MAP_SOURCE_TYPES = ['own_team', 'participant_team', 'observed_wifi'] as const;
export type ChannelMapSourceType = (typeof CHANNEL_MAP_SOURCE_TYPES)[number];

// own_team / participant_team 共通フィールド定義
const teamConfigFields = {
  band: z.enum(BANDS),
  channel: z.number().int().positive(),
  channelWidthMHz: z.number().int().positive(),
  wifiConfigId: z.string().uuid(),
  wifiConfigName: z.string(),
  teamId: z.string().uuid(),
  teamName: z.string(),
  purpose: z.enum(PURPOSES),
  role: z.enum(WIFI_CONFIG_ROLES),
  status: z.enum(WIFI_CONFIG_STATUSES),
  // H-2: AP 機材モデル (wifiConfigs.apDeviceId 未設定の場合は null)
  apDeviceModel: z.string().nullable(),
  // H-2: クライアント機材モデル (wifiConfigs.clientDeviceId 未設定の場合は null)
  clientDeviceModel: z.string().nullable(),
  // H-2: wifiConfigId に紐づく不具合報告件数
  reportCount: z.number().int().nonnegative(),
};

export const ChannelMapEntrySchema = z.discriminatedUnion('sourceType', [
  // 自チームの WiFi 構成
  z.object({
    sourceType: z.literal('own_team'),
    ...teamConfigFields,
  }),
  // 他の参加チームの WiFi 構成
  z.object({
    sourceType: z.literal('participant_team'),
    ...teamConfigFields,
  }),
  // 野良 WiFi / 運営観測 WiFi
  z.object({
    sourceType: z.literal('observed_wifi'),
    band: z.enum(BANDS),
    channel: z.number().int().positive(),
    channelWidthMHz: z.number().int().positive().optional(),
    observedWifiId: z.string().uuid(),
    ssid: z.string().nullable().optional(),
    bssid: optionalFromNullable(z.string().regex(/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/)),
    source: z.enum(OBSERVED_WIFI_SOURCES),
    // H-2: RSSI (dBm)。データがない場合は null
    rssi: z.number().nullable(),
    // H-2: 観測位置ラベル。データがない場合は null
    locationLabel: z.string().nullable(),
    // H-2: 観測日時 (ISO 8601 文字列)
    observedAt: z.string(),
  }),
]);

export type ChannelMapEntry = z.infer<typeof ChannelMapEntrySchema>;
