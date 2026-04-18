import { z } from 'zod';
import { BANDS, DEVICE_KINDS } from '../enums.js';
import { DateTimeStringSchema, optionalFromNullable } from './common.js';

export const DeviceSpecSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  vendor: optionalFromNullable(z.string().max(200)),
  model: z.string().min(1).max(200),
  kind: z.enum(DEVICE_KINDS),
  supportedBands: z.array(z.enum(BANDS)).min(1),
  notes: optionalFromNullable(z.string().max(2000)),
  knownIssues: optionalFromNullable(z.string().max(2000)),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
  archivedAt: optionalFromNullable(DateTimeStringSchema),
});

export const CreateDeviceSpecSchema = DeviceSpecSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const UpdateDeviceSpecSchema = CreateDeviceSpecSchema.omit({ teamId: true }).partial();

export type DeviceSpec = z.infer<typeof DeviceSpecSchema>;
export type CreateDeviceSpec = z.infer<typeof CreateDeviceSpecSchema>;
export type UpdateDeviceSpec = z.infer<typeof UpdateDeviceSpecSchema>;
