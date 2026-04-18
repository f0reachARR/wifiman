import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';

const SESSION_VERSION = 1;

export type TeamAccessSession = {
  version: typeof SESSION_VERSION;
  teamAccessId: string;
  teamId: string;
  tournamentId: string;
  role: 'editor' | 'viewer';
  expiresAt: number;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: string): string {
  return createHmac('sha256', env.BETTER_AUTH_SECRET).update(payload).digest('base64url');
}

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const aBuffer = Buffer.from(a, 'base64url');
    const bBuffer = Buffer.from(b, 'base64url');
    if (aBuffer.length !== bBuffer.length) return false;
    return timingSafeEqual(aBuffer, bBuffer);
  } catch {
    return false;
  }
}

export function createTeamAccessSessionCookie(
  input: Omit<TeamAccessSession, 'version' | 'expiresAt'>,
  maxAgeSeconds: number,
): string {
  const session: TeamAccessSession = {
    version: SESSION_VERSION,
    ...input,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  };
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifyTeamAccessSessionCookie(value: string | undefined): TeamAccessSession | null {
  if (!value) return null;

  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra !== undefined) return null;

  const expectedSignature = signPayload(payload);
  if (!timingSafeStringEqual(signature, expectedSignature)) return null;

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as Partial<TeamAccessSession>;
    if (session.version !== SESSION_VERSION) return null;
    if (!session.teamAccessId || !session.teamId || !session.tournamentId) return null;
    if (session.role !== 'editor' && session.role !== 'viewer') return null;
    if (typeof session.expiresAt !== 'number' || session.expiresAt <= Date.now()) return null;
    return session as TeamAccessSession;
  } catch {
    return null;
  }
}
