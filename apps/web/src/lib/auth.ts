import { redirect } from '@tanstack/react-router';
import { TEAM_ACCESS_ROLES, type TeamAccessRole } from '@wifiman/shared';
import { z } from 'zod';

const AUTH_STORAGE_KEY = 'wifiman.web.auth';

const OperatorSessionSchema = z.object({
  kind: z.literal('operator'),
  displayName: z.string().min(1),
  createdAt: z.string().datetime(),
});

const TeamSessionSchema = z.object({
  kind: z.literal('team'),
  role: z.enum(TEAM_ACCESS_ROLES),
  teamId: z.string().min(1),
  accessTokenPreview: z.string().min(4),
  createdAt: z.string().datetime(),
});

const AuthSessionSchema = z.union([OperatorSessionSchema, TeamSessionSchema]);

export type AuthSession = z.infer<typeof AuthSessionSchema>;

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function createOperatorSession(displayName: string): AuthSession {
  return {
    kind: 'operator',
    displayName: displayName.trim(),
    createdAt: new Date().toISOString(),
  };
}

export function createTeamSession(token: string, role: TeamAccessRole): AuthSession {
  return {
    kind: 'team',
    role,
    teamId: crypto.randomUUID(),
    accessTokenPreview: token.slice(0, 8),
    createdAt: new Date().toISOString(),
  };
}

export function getStoredAuthSession(): AuthSession | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const raw = storage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  const parsed = AuthSessionSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    storage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }

  return parsed.data;
}

export function setStoredAuthSession(session: AuthSession) {
  const storage = getStorage();

  storage?.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAuthSession() {
  const storage = getStorage();

  storage?.removeItem(AUTH_STORAGE_KEY);
}

export function getProtectedRedirectPath(pathname: string, session: AuthSession | null) {
  if (session) {
    return null;
  }

  return pathname === '/app/sync' ? '/login?next=%2Fapp%2Fsync' : '/login';
}

export function ensureAuthenticatedForPath(pathname: string) {
  const destination = getProtectedRedirectPath(pathname, getStoredAuthSession());

  if (!destination) {
    return;
  }

  if (destination === '/login') {
    throw redirect({ to: '/login' });
  }

  throw redirect({
    to: '/login',
    search: {
      next: '/app/sync',
    },
  });
}
