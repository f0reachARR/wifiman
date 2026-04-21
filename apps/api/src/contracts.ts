import { TEAM_ACCESS_ROLES, VerifyTeamLinkSchema } from '@wifiman/shared';
import { z } from 'zod';

export const AUTH_SESSION_PATH = '/auth/session';
export const DEV_OPERATOR_SESSION_PATH = '/auth/dev-operator-session';
export const VERIFY_TEAM_ACCESS_PATH = '/team-accesses/verify';

export const operatorSessionSchema = z.object({
  kind: z.literal('operator'),
  role: z.literal('operator'),
  sessionId: z.string().min(1),
  displayName: z.string().min(1),
});

export const teamSessionSchema = z.object({
  kind: z.literal('team'),
  role: z.enum(TEAM_ACCESS_ROLES),
  teamId: z.string().uuid(),
  tournamentId: z.string().uuid(),
  teamAccessId: z.string().uuid(),
});

export const authSessionSchema = z.union([operatorSessionSchema, teamSessionSchema]);
export const createDevOperatorSessionInputSchema = z.object({
  displayName: z.string().trim().min(1),
  passphrase: z.string().min(8),
});
export const verifyTeamAccessInputSchema = VerifyTeamLinkSchema;

export type AuthSessionContract = z.infer<typeof authSessionSchema>;
export type OperatorSessionContract = z.infer<typeof operatorSessionSchema>;
export type TeamSessionContract = z.infer<typeof teamSessionSchema>;
export type CreateDevOperatorSessionInput = z.infer<typeof createDevOperatorSessionInputSchema>;
export type VerifyTeamAccessInput = z.infer<typeof verifyTeamAccessInputSchema>;
