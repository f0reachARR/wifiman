import { z } from 'zod';
import { BANDS, BEST_PRACTICE_SCOPES } from '../enums.js';
import { DateTimeStringSchema, optionalFromNullable } from './common.js';

export const BestPracticeSchema = z.object({
  id: z.string().uuid(),
  tournamentId: optionalFromNullable(z.string().uuid()),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  scope: z.enum(BEST_PRACTICE_SCOPES),
  targetBand: optionalFromNullable(z.enum(BANDS)),
  targetModel: optionalFromNullable(z.string().min(1).max(200)),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

function refineBestPracticeScope(
  value: {
    tournamentId?: string | undefined;
    scope?: (typeof BEST_PRACTICE_SCOPES)[number] | undefined;
    targetBand?: string | undefined;
    targetModel?: string | undefined;
  },
  ctx: z.RefinementCtx,
) {
  if (value.scope === 'general') {
    if (value.tournamentId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tournamentId'],
        message: 'scope が general の場合 tournamentId は指定できません',
      });
    }
    if (value.targetBand !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetBand'],
        message: 'scope が general の場合 targetBand は指定できません',
      });
    }
    if (value.targetModel !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetModel'],
        message: 'scope が general の場合 targetModel は指定できません',
      });
    }
  }

  if (value.scope === 'tournament') {
    if (value.tournamentId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tournamentId'],
        message: 'scope が tournament の場合 tournamentId が必要です',
      });
    }
    if (value.targetBand !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetBand'],
        message: 'scope が tournament の場合 targetBand は指定できません',
      });
    }
    if (value.targetModel !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetModel'],
        message: 'scope が tournament の場合 targetModel は指定できません',
      });
    }
  }

  if (value.scope === 'band') {
    if (value.targetBand === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetBand'],
        message: 'scope が band の場合 targetBand が必要です',
      });
    }
    if (value.targetModel !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetModel'],
        message: 'scope が band の場合 targetModel は指定できません',
      });
    }
  }

  if (value.scope === 'device' && value.targetModel === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetModel'],
      message: 'scope が device の場合 targetModel が必要です',
    });
  }
}

const BestPracticeInputSchema = BestPracticeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const CreateBestPracticeSchema =
  BestPracticeInputSchema.superRefine(refineBestPracticeScope);

export const UpdateBestPracticeSchema = BestPracticeInputSchema.partial();

export type BestPractice = z.infer<typeof BestPracticeSchema>;
export type CreateBestPractice = z.infer<typeof CreateBestPracticeSchema>;
export type UpdateBestPractice = z.infer<typeof UpdateBestPracticeSchema>;
