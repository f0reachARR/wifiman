import { isTokenValid } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { auth } from '../auth.js';
import { canEditTeam, canViewTeam, hasParticipantRole } from '../authz.js';
import { db } from '../db/index.js';
import { teamAccesses, teams } from '../db/schema/index.js';
import { forbidden, unauthorized } from '../errors.js';
import { verifyTeamAccessSessionCookie } from '../teamAccessSession.js';

export type AuthContext = {
  userId?: string;
  userRole?: 'user' | 'operator';
  teamId?: string;
  teamTournamentId?: string;
  teamAccessRole?: 'editor' | 'viewer';
};

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
    _targetTeamId: string;
    _targetTournamentId: string;
  }
}

function resolveTargetTournamentId(c: Context): string | undefined {
  const fromContext = c.get('_targetTournamentId');
  if (fromContext) return fromContext;

  const fromParam = c.req.param('tournamentId');
  if (fromParam) return fromParam;

  const fromQuery = c.req.query('tournamentId');
  if (fromQuery) return fromQuery;

  return undefined;
}

function assertTeamTournamentScope(authCtx: AuthContext | undefined, targetTournamentId: string) {
  if (!authCtx?.teamId) return;

  if (!authCtx.teamTournamentId || authCtx.teamTournamentId !== targetTournamentId) {
    throw forbidden('対象大会へのアクセス権限がありません');
  }
}

/**
 * セッションをコンテキストへセットする (必須ではない)。
 */
export async function setAuthContext(c: Context, next: Next) {
  const authCtx: AuthContext = {};

  // Better Auth セッションの確認
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (session?.user) {
    authCtx.userId = session.user.id;
    authCtx.userRole = (session.user as { role?: 'user' | 'operator' }).role ?? 'user';
  }

  // チーム編集の短期セッション Cookie を確認する。
  const teamAccessSession = verifyTeamAccessSessionCookie(getCookie(c, 'team_access_session'));
  if (teamAccessSession) {
    const access = await db.query.teamAccesses.findFirst({
      where: eq(teamAccesses.id, teamAccessSession.teamAccessId),
    });
    if (
      access &&
      isTokenValid(access.revokedAt?.toISOString()) &&
      access.teamId === teamAccessSession.teamId &&
      access.role === teamAccessSession.role
    ) {
      authCtx.teamId = access.teamId;
      authCtx.teamAccessRole = access.role;

      const team = await db.query.teams.findFirst({ where: eq(teams.id, access.teamId) });
      if (team && team.tournamentId === teamAccessSession.tournamentId) {
        authCtx.teamTournamentId = team.tournamentId;
      }

      // last_used_at を更新
      await db
        .update(teamAccesses)
        .set({ lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(teamAccesses.id, teamAccessSession.teamAccessId));
    }
  }

  c.set('auth', authCtx);
  await next();
}

/**
 * 運営者権限を要求するミドルウェア。
 */
export function requireOperator(c: Context, next: Next) {
  const authCtx = c.get('auth');
  if (!authCtx?.userId) {
    throw unauthorized();
  }
  if (authCtx.userRole !== 'operator') {
    throw forbidden('運営者権限が必要です');
  }
  return next();
}

/**
 * 参加者閲覧権限（operator / チームトークン所持者）を要求するミドルウェア。
 * 単なる user ログインは拒否する。
 */
export function requireAnyViewer(c: Context, next: Next) {
  const authCtx = c.get('auth');
  const targetTournamentId = resolveTargetTournamentId(c);

  if (targetTournamentId) {
    assertTeamTournamentScope(authCtx, targetTournamentId);
  }

  if (authCtx?.userRole === 'operator') return next();
  if (authCtx?.teamId) return next();
  if (authCtx?.userId) throw forbidden('チーム参加者または運営者権限が必要です');
  throw unauthorized();
}

/**
 * チームの閲覧権限を要求するミドルウェア。
 * 運営者はすべてのチームを閲覧可能。
 * チームトークン所持者は自チームをフル閲覧でき、他チームは公開経路のみ閲覧可能。
 */
export function requireTeamViewer(teamIdParam = 'teamId') {
  return (c: Context, next: Next) => {
    const authCtx = c.get('auth');
    const targetTeamId = c.get('_targetTeamId') ?? c.req.param(teamIdParam);
    const targetTournamentId = resolveTargetTournamentId(c);

    if (targetTournamentId) {
      assertTeamTournamentScope(authCtx, targetTournamentId);
    }

    if (canViewTeam(authCtx, targetTeamId)) {
      return next();
    }

    if (
      authCtx?.teamId &&
      (authCtx.teamAccessRole === 'viewer' || authCtx.teamAccessRole === 'editor')
    ) {
      return next();
    }

    if (!authCtx?.userId && !authCtx?.teamId) {
      throw unauthorized();
    }
    throw forbidden('対象チームへのアクセス権限がありません');
  };
}

/**
 * チームの編集権限を要求するミドルウェア。
 */
export function requireTeamEditor(teamIdParam = 'teamId') {
  return (c: Context, next: Next) => {
    const authCtx = c.get('auth');
    const targetTeamId = c.get('_targetTeamId') ?? c.req.param(teamIdParam);

    if (canEditTeam(authCtx, targetTeamId)) {
      return next();
    }

    if (!authCtx?.userId && !authCtx?.teamId) {
      throw unauthorized();
    }
    throw forbidden('対象チームの編集権限がありません');
  };
}

/**
 * 大会参加者（任意チームのアクセストークン所持者）または運営者を要求するミドルウェア。
 * 単なる userId ログインは拒否する。
 */
export function requireParticipant(c: Context, next: Next) {
  const authCtx = c.get('auth');
  if (hasParticipantRole(authCtx)) return next();
  if (!authCtx?.userId) throw unauthorized();
  throw forbidden('チーム参加者または運営者権限が必要です');
}
