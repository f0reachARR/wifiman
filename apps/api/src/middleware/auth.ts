import { isTokenValid, verifyAccessToken } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { auth } from '../auth.js';
import { canEditTeam, canViewTeam, hasParticipantRole } from '../authz.js';
import { db } from '../db/index.js';
import { teamAccesses } from '../db/schema/index.js';
import { forbidden, unauthorized } from '../errors.js';

export type AuthContext = {
  userId?: string;
  userRole?: 'user' | 'operator';
  teamId?: string;
  teamAccessRole?: 'editor' | 'viewer';
};

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
    _targetTeamId: string;
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

  // チーム編集トークン Cookie の確認
  const teamToken = getCookie(c, 'team_access_token');
  const teamAccessId = getCookie(c, 'team_access_id');
  if (teamToken && teamAccessId) {
    const access = await db.query.teamAccesses.findFirst({
      where: eq(teamAccesses.id, teamAccessId),
    });
    if (
      access &&
      isTokenValid(access.revokedAt?.toISOString()) &&
      verifyAccessToken(teamToken, access.accessTokenHash)
    ) {
      authCtx.teamId = access.teamId;
      authCtx.teamAccessRole = access.role;
      // last_used_at を更新
      await db
        .update(teamAccesses)
        .set({ lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(teamAccesses.id, teamAccessId));
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
 * 何らかの認証済みユーザ（operator / チームトークン所持者 / ログイン済みユーザ）を要求するミドルウェア。
 */
export function requireAnyViewer(c: Context, next: Next) {
  const authCtx = c.get('auth');
  if (authCtx?.userRole === 'operator') return next();
  if (authCtx?.teamId) return next();
  if (authCtx?.userId) return next();
  throw unauthorized();
}

/**
 * チームの閲覧権限を要求するミドルウェア。
 * 運営者はすべてのチームを閲覧可能。
 * チームトークン所持者は自チームのみ閲覧可能。
 */
export function requireTeamViewer(teamIdParam = 'teamId') {
  return (c: Context, next: Next) => {
    const authCtx = c.get('auth');
    const targetTeamId = c.get('_targetTeamId') ?? c.req.param(teamIdParam);

    if (canViewTeam(authCtx, targetTeamId)) {
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
