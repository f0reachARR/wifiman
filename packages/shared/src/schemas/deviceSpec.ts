import { z } from 'zod';
import { BANDS, DEVICE_KINDS } from '../enums.js';

export const DeviceSpecSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  vendor: z.string().max(200).optional(),
  model: z.string().min(1).max(200),
  kind: z.enum(DEVICE_KINDS),
  supportedBands: z.array(z.enum(BANDS)).min(1),
  notes: z.string().max(2000).optional(),
  knownIssues: z.string().max(2000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateDeviceSpecSchema = DeviceSpecSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateDeviceSpecSchema = CreateDeviceSpecSchema.omit({ teamId: true }).partial();

export type DeviceSpec = z.infer<typeof DeviceSpecSchema>;
export type CreateDeviceSpec = z.infer<typeof CreateDeviceSpecSchema>;
export type UpdateDeviceSpec = z.infer<typeof UpdateDeviceSpecSchema>;
