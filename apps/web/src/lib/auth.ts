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

export const DEFAULT_AUTHENTICATED_REDIRECT_PATH = '/app';

export const BetterAuthLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'メールアドレスを入力してください')
    .email('メールアドレスを入力してください'),
  password: z.string().trim().min(1, 'パスワードを入力してください'),
});

export const DevOperatorLoginSchema = z.object({
  displayName: z.string().trim().min(1, '表示名を入力してください'),
  passphrase: z.string().trim().min(8, '8 文字以上のパスフレーズを入力してください'),
});

export const TeamAccessLoginSchema = z.object({
  token: z.string().trim().length(64, 'トークンは 64 文字で入力してください'),
});

export type BetterAuthLoginInput = z.infer<typeof BetterAuthLoginSchema>;
export type DevOperatorLoginInput = z.infer<typeof DevOperatorLoginSchema>;
export type TeamAccessLoginInput = z.infer<typeof TeamAccessLoginSchema>;

export function parseAuthSession(input: unknown): AuthSession {
  return AuthSessionSchema.parse(input);
}

export function parseBetterAuthLoginInput(input: unknown): BetterAuthLoginInput {
  return BetterAuthLoginSchema.parse(input);
}

export function parseDevOperatorLoginInput(input: unknown): DevOperatorLoginInput {
  return DevOperatorLoginSchema.parse(input);
}

export function parseTeamAccessLoginInput(input: unknown): TeamAccessLoginInput {
  return TeamAccessLoginSchema.parse(input);
}

export function isDevOperatorAuthEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_OPERATOR_AUTH === 'true';
}

export function getLoginMode(): LoginMode {
  return isDevOperatorAuthEnabled() ? 'dev-operator' : 'better-auth';
}

function isSafeInternalRedirectPath(path: string) {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
}

export function getPostLoginRedirectPath(nextPath: string | null | undefined) {
  if (!nextPath || !isSafeInternalRedirectPath(nextPath)) {
    return DEFAULT_AUTHENTICATED_REDIRECT_PATH;
  }

  return nextPath;
}

export function getProtectedRedirectPath(
  pathname: string,
  session: AuthSession | null,
  search = '',
) {
  if (session) {
    return null;
  }

  const nextPath = `${pathname}${search}`;

  if (nextPath === '/app') {
    return '/login';
  }

  return `/login?next=${encodeURIComponent(nextPath)}`;
}
