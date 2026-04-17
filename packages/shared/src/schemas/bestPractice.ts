import { z } from 'zod';
import { BANDS, BEST_PRACTICE_SCOPES } from '../enums.js';

export const BestPracticeSchema = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  scope: z.enum(BEST_PRACTICE_SCOPES),
  targetBand: z.enum(BANDS).optional(),
  targetModel: z.string().max(200).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateBestPracticeSchema = BestPracticeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateBestPracticeSchema = CreateBestPracticeSchema.partial();

export type BestPractice = z.infer<typeof BestPracticeSchema>;
export type CreateBestPractice = z.infer<typeof CreateBestPracticeSchema>;
export type UpdateBestPractice = z.infer<typeof UpdateBestPracticeSchema>;
