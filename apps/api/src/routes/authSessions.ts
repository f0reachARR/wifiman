import { createRoute } from '@hono/zod-openapi';
import { deleteCookie, setCookie } from 'hono/cookie';
import { auth } from '../auth.js';
import {
  authSessionSchema,
  createDevOperatorSessionInputSchema,
  operatorSessionSchema,
} from '../contracts.js';
import { env } from '../env.js';
import { forbidden, unauthorized } from '../errors.js';
import { createOpenApiApp, errorSchema } from '../openapi.js';
import {
  createOperatorDevSessionCookie,
  OPERATOR_DEV_SESSION_COOKIE_NAME,
} from '../operatorDevSession.js';

const app = createOpenApiApp();

const createDevOperatorSessionSchema = createDevOperatorSessionInputSchema;

const getAuthSession = createRoute({
  method: 'get',
  path: '/auth/session',
  tags: ['auth'],
  responses: {
    200: {
      content: { 'application/json': { schema: authSessionSchema } },
      description: '現在の認証セッション',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
  },
});

app.openapi(getAuthSession, async (c) => {
  const authCtx = c.get('auth');

  if (authCtx.userRole === 'operator' && authCtx.operatorSessionId && authCtx.operatorDisplayName) {
    return c.json(
      {
        kind: 'operator',
        role: 'operator',
        sessionId: authCtx.operatorSessionId,
        displayName: authCtx.operatorDisplayName,
      },
      200,
    );
  }

  if (
    authCtx.teamId &&
    authCtx.teamTournamentId &&
    authCtx.teamAccessRole &&
    authCtx.teamAccessId
  ) {
    return c.json(
      {
        kind: 'team',
        role: authCtx.teamAccessRole,
        teamId: authCtx.teamId,
        tournamentId: authCtx.teamTournamentId,
        teamAccessId: authCtx.teamAccessId,
      },
      200,
    );
  }

  throw unauthorized();
});

const createDevOperatorSession = createRoute({
  method: 'post',
  path: '/auth/dev-operator-session',
  tags: ['auth'],
  request: {
    body: {
      content: { 'application/json': { schema: createDevOperatorSessionSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: operatorSessionSchema } },
      description: '開発用運営セッションを作成',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'パスフレーズ不正',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: '開発機能無効',
    },
  },
});

app.openapi(createDevOperatorSession, async (c) => {
  if (!env.DEV_OPERATOR_AUTH_ENABLED || env.NODE_ENV === 'production') {
    throw forbidden('開発用運営ログインは無効です');
  }

  if (!env.DEV_OPERATOR_AUTH_PASSPHRASE) {
    throw forbidden('開発用運営ログインのパスフレーズが未設定です');
  }

  const { displayName, passphrase } = c.req.valid('json');

  if (passphrase !== env.DEV_OPERATOR_AUTH_PASSPHRASE) {
    throw unauthorized('パスフレーズが正しくありません');
  }

  const sessionId = crypto.randomUUID();
  const maxAge = 60 * 60 * 8;
  const sessionCookie = createOperatorDevSessionCookie(
    {
      sessionId,
      displayName,
    },
    maxAge,
  );

  setCookie(c, OPERATOR_DEV_SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
    maxAge,
    path: '/',
  });

  return c.json(
    {
      kind: 'operator' as const,
      role: 'operator' as const,
      sessionId,
      displayName,
    },
    200,
  );
});

const clearAuthSession = createRoute({
  method: 'delete',
  path: '/auth/session',
  tags: ['auth'],
  responses: {
    204: {
      description: 'セッション cookie を削除',
    },
  },
});

app.openapi(clearAuthSession, async (c) => {
  deleteCookie(c, 'team_access_session', { path: '/' });
  deleteCookie(c, OPERATOR_DEV_SESSION_COOKIE_NAME, { path: '/' });

  await auth.api.signOut({ headers: c.req.raw.headers }).catch(() => null);

  return c.body(null, 204);
});

export default app;
