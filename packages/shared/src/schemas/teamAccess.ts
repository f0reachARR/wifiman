import { z } from 'zod';
import { TEAM_ACCESS_ROLES } from '../enums.js';

export const TeamAccessSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  email: z.string().email().max(254),
  accessTokenHash: z.string(),
  issuedAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().optional(),
  revokedAt: z.string().datetime().optional(),
  role: z.enum(TEAM_ACCESS_ROLES),
});

export const CreateTeamAccessSchema = z.object({
  teamId: z.string().uuid(),
  email: z.string().email().max(254),
  role: z.enum(TEAM_ACCESS_ROLES).default('editor'),
});

export const VerifyTeamLinkSchema = z.object({
  token: z.string().min(64).max(64),
});

export type TeamAccess = z.infer<typeof TeamAccessSchema>;
export type CreateTeamAccess = z.infer<typeof CreateTeamAccessSchema>;
export type VerifyTeamLink = z.infer<typeof VerifyTeamLinkSchema>;
