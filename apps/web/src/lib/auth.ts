import { TEAM_ACCESS_ROLES } from '@wifiman/shared';
import { z } from 'zod';

const OperatorSessionSchema = z.object({
  kind: z.literal('operator'),
  role: z.literal('operator'),
  sessionId: z.string().min(1),
  displayName: z.string().min(1),
});

const TeamSessionSchema = z.object({
  kind: z.literal('team'),
  role: z.enum(TEAM_ACCESS_ROLES),
  teamId: z.string().uuid(),
  tournamentId: z.string().uuid(),
  teamAccessId: z.string().uuid(),
});

const AuthSessionSchema = z.union([OperatorSessionSchema, TeamSessionSchema]);

export type AuthSession = z.infer<typeof AuthSessionSchema>;

export type LoginMode = 'better-auth' | 'dev-operator';

export function parseAuthSession(input: unknown): AuthSession {
  return AuthSessionSchema.parse(input);
}

export function isDevOperatorAuthEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_OPERATOR_AUTH === 'true';
}

export function getLoginMode(): LoginMode {
  return isDevOperatorAuthEnabled() ? 'dev-operator' : 'better-auth';
}

export function getProtectedRedirectPath(pathname: string, session: AuthSession | null) {
  if (session) {
    return null;
  }

  return pathname === '/app/sync' ? '/login?next=%2Fapp%2Fsync' : '/login';
}
