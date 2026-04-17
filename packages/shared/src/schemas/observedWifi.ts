import { z } from 'zod';
import { BANDS, OBSERVED_WIFI_SOURCES } from '../enums.js';

export const ObservedWifiSchema = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid(),
  source: z.enum(OBSERVED_WIFI_SOURCES),
  ssid: z.string().max(32).optional(),
  bssid: z
    .string()
    .regex(/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/)
    .optional(),
  band: z.enum(BANDS),
  channel: z.number().int().positive(),
  channelWidthMHz: z.number().int().positive().optional(),
  rssi: z.number().int().min(-120).max(0).optional(),
  locationLabel: z.string().max(200).optional(),
  observedAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateObservedWifiSchema = ObservedWifiSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const BulkCreateObservedWifiSchema = z.object({
  items: z.array(CreateObservedWifiSchema).min(1).max(1000),
});

export type ObservedWifi = z.infer<typeof ObservedWifiSchema>;
export type CreateObservedWifi = z.infer<typeof CreateObservedWifiSchema>;
export type BulkCreateObservedWifi = z.infer<typeof BulkCreateObservedWifiSchema>;
