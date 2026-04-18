import { z } from 'zod';
import { BANDS, OBSERVED_WIFI_SOURCES } from '../enums.js';
import { DateTimeStringSchema, optionalFromNullable } from './common.js';

export const ObservedWifiSchema = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid(),
  source: z.enum(OBSERVED_WIFI_SOURCES),
  ssid: optionalFromNullable(z.string().max(32)),
  bssid: optionalFromNullable(z.string().regex(/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/)),
  band: z.enum(BANDS),
  channel: z.number().int().positive(),
  channelWidthMHz: optionalFromNullable(z.number().int().positive()),
  rssi: optionalFromNullable(z.number().min(-120).max(0)),
  locationLabel: optionalFromNullable(z.string().max(200)),
  observedAt: DateTimeStringSchema,
  notes: optionalFromNullable(z.string().max(2000)),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
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
