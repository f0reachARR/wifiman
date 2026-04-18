import { z } from 'zod';
import {
  BANDS,
  CHANNEL_WIDTHS,
  PURPOSES,
  WIFI_CONFIG_ROLES,
  WIFI_CONFIG_STATUSES,
} from '../enums.js';
import { DateTimeStringSchema, optionalFromNullable } from './common.js';

export const WifiConfigSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  name: z.string().min(1).max(200),
  purpose: z.enum(PURPOSES),
  band: z.enum(BANDS),
  channel: z.number().int().positive(),
  channelWidthMHz: z.union([z.literal(20), z.literal(40), z.literal(80), z.literal(160)]),
  role: z.enum(WIFI_CONFIG_ROLES),
  status: z.enum(WIFI_CONFIG_STATUSES),
  apDeviceId: optionalFromNullable(z.string().uuid()),
  clientDeviceId: optionalFromNullable(z.string().uuid()),
  expectedDistanceCategory: optionalFromNullable(z.enum(['near', 'mid', 'far'])),
  pingTargetIp: optionalFromNullable(z.string().ip().max(45)),
  notes: optionalFromNullable(z.string().max(2000)),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const CreateWifiConfigSchema = WifiConfigSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateWifiConfigSchema = CreateWifiConfigSchema.omit({ teamId: true }).partial();

export type WifiConfig = z.infer<typeof WifiConfigSchema>;
export type CreateWifiConfig = z.infer<typeof CreateWifiConfigSchema>;
export type UpdateWifiConfig = z.infer<typeof UpdateWifiConfigSchema>;

// CHANNEL_WIDTHS をそのまま使うための型
export const ChannelWidthSchema = z.union([
  z.literal(20),
  z.literal(40),
  z.literal(80),
  z.literal(160),
]);
export { CHANNEL_WIDTHS };
