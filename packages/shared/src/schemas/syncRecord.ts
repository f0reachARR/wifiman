import { z } from 'zod';
import { SYNC_ACTIONS, SYNC_RECORD_STATUSES } from '../enums.js';
import { DateTimeStringSchema, optionalFromNullable } from './common.js';

export const SyncRecordSchema = z.object({
  id: z.string().uuid(),
  entityType: z.string().min(1).max(100),
  entityId: z.string().uuid(),
  action: z.enum(SYNC_ACTIONS),
  status: z.enum(SYNC_RECORD_STATUSES),
  errorMessage: optionalFromNullable(z.string().max(2000)),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export type SyncRecord = z.infer<typeof SyncRecordSchema>;
