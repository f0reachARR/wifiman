import { z } from 'zod';
import { NOTICE_SEVERITIES } from '../enums.js';
import { DateTimeStringSchema, optionalFromNullable } from './common.js';

export const NoticeSchema = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  severity: z.enum(NOTICE_SEVERITIES),
  publishedAt: DateTimeStringSchema,
  expiresAt: optionalFromNullable(DateTimeStringSchema),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const CreateNoticeSchema = NoticeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateNoticeSchema = CreateNoticeSchema.omit({ tournamentId: true }).partial();

export type Notice = z.infer<typeof NoticeSchema>;
export type CreateNotice = z.infer<typeof CreateNoticeSchema>;
export type UpdateNotice = z.infer<typeof UpdateNoticeSchema>;
