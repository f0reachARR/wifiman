import { z } from 'zod';
import { SYNC_ACTIONS, SYNC_RECORD_STATUSES } from '../enums.js';

export const SyncRecordSchema = z.object({
  id: z.string().uuid(),
  entityType: z.string().min(1).max(100),
  entityId: z.string().uuid(),
  action: z.enum(SYNC_ACTIONS),
  status: z.enum(SYNC_RECORD_STATUSES),
  errorMessage: z.string().max(2000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SyncRecord = z.infer<typeof SyncRecordSchema>;
