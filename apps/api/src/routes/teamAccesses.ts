import { createRoute, z } from '@hono/zod-openapi';
import { CreateTeamAccessSchema, TeamAccessSchema, VerifyTeamLinkSchema } from '@wifiman/shared';
import {
  generateAccessToken,
  hashAccessToken,
  isTokenValid,
  verifyAccessToken,
} from '@wifiman/shared/server';
import { and, eq, isNull } from 'drizzle-orm';
import { deleteCookie, setCookie } from 'hono/cookie';
import { db } from '../db/index.js';
import { teamAccesses, teams } from '../db/schema/index.js';
import type { TeamAccessRow } from '../db/schema/teamAccesses.js';
import { env } from '../env.js';
import { conflict, notFound, unauthorized } from '../errors.js';
import { createMailer } from '../mailer/index.js';
import { requireOperator } from '../middleware/auth.js';
import { createOpenApiApp, errorSchema } from '../openapi.js';
import { fixedWindowRateLimit } from '../rateLimit.js';
import { createTeamAccessSessionCookie } from '../teamAccessSession.js';

const app = createOpenApiApp();
const publicTeamAccessSchema = TeamAccessSchema.omit({ accessTokenHash: true });
const publicTeamAccessListSchema = z.array(publicTeamAccessSchema);
const createTeamAccessResponseSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  email: z.string(),
  role: z.enum(['editor', 'viewer']),
  delivery: z.object({
    status: z.enum(['sent', 'not_configured', 'failed']),
    accessLink: z.string().url().optional(),
    message: z.string().optional(),
  }),
});
const messageSchema = z.object({ message: z.string() });
const verifyResponseSchema = z.object({
  kind: z.literal('team'),
  teamId: z.string().uuid(),
  tournamentId: z.string().uuid(),
  teamAccessId: z.string().uuid(),
  role: z.enum(['editor', 'viewer']),
});
const teamAccessSessionResponseSchema = z.object({
  teamId: z.string().uuid(),
  tournamentId: z.string().uuid(),
  teamAccessId: z.string().uuid(),
  role: z.enum(['editor', 'viewer']),
});
const resendTeamAccessResponseSchema = messageSchema.extend({
  delivery: z.object({
    status: z.enum(['sent', 'not_configured', 'failed']),
    accessLink: z.string().url().optional(),
    message: z.string().optional(),
  }),
});

type DeliveryResult = z.infer<typeof createTeamAccessResponseSchema>['delivery'];

function isSingleActiveTokenViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = Reflect.get(err, 'code');
  const constraintName = Reflect.get(err, 'constraint_name') ?? Reflect.get(err, 'constraint');
  return code === '23505' && constraintName === 'team_accesses_single_active_per_team';
}

async function sendAccessLinkOrReturnRecovery(
  email: string,
  teamId: string,
  link: string,
): Promise<DeliveryResult> {
  const mailer = createMailer();
  if (!mailer) {
    return {
      status: 'not_configured',
      accessLink: link,
      message: 'SMTP が未設定のため、アクセスリンクを API レスポンスに含めます',
    };
  }

  try {
    await mailer.sendTeamAccessLink(email, teamId, link);
    return { status: 'sent' };
  } catch (err) {
    console.error('チーム編集リンク送信失敗:', err);
    return {
      status: 'failed',
      accessLink: link,
      message: 'メール送信に失敗したため、アクセスリンクを API レスポンスに含めます',
    };
  }
}

async function findTeamOrThrow(teamId: string) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  });
  if (!team) throw notFound('チームが見つかりません');
  return team;
}

// GET /api/teams/:teamId/team-accesses - チームアクセス一覧 (operator)
const listTeamAccesses = createRoute({
  method: 'get',
  path: '/teams/{teamId}/team-accesses',
  tags: ['team-accesses'],
  middleware: [requireOperator] as const,
  request: { params: z.object({ teamId: z.string() }) },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.array(publicTeamAccessSchema) },
      },
      description: 'チームアクセス一覧',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: '権限なし',
    },
    409: {
      content: { 'application/json': { schema: errorSchema } },
      description: '競合',
    },
  },
});
app.openapi(listTeamAccesses, async (c) => {
  const { teamId } = c.req.valid('param');
  const rows = await db.select().from(teamAccesses).where(eq(teamAccesses.teamId, teamId));
  // accessTokenHash は外部に露出しない
  return c.json(
    publicTeamAccessListSchema.parse(rows.map(({ accessTokenHash: _h, ...rest }) => rest)),
    200,
  );
});

// POST /api/teams/:teamId/team-accesses - 編集リンク発行 (operator)
const createTeamAccess = createRoute({
  method: 'post',
  path: '/teams/{teamId}/team-accesses',
  tags: ['team-accesses'],
  middleware: [requireOperator] as const,
  request: {
    params: z.object({ teamId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: CreateTeamAccessSchema.omit({ teamId: true }),
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': { schema: createTeamAccessResponseSchema },
      },
      description: '編集リンク発行',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: '権限なし',
    },
  },
});
app.openapi(createTeamAccess, async (c) => {
  const { teamId } = c.req.valid('param');
  const body = c.req.valid('json');

  await findTeamOrThrow(teamId);

  let access: TeamAccessRow | undefined;
  const token = generateAccessToken();
  const hash = hashAccessToken(token);
  try {
    access = await db.transaction(async (tx) => {
      // 再発行扱い: 既存の有効トークンを失効させ、常に最新リンクのみ有効にする。
      await tx
        .update(teamAccesses)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(teamAccesses.teamId, teamId), isNull(teamAccesses.revokedAt)));

      const [inserted] = await tx
        .insert(teamAccesses)
        .values({
          teamId,
          email: body.email,
          accessTokenHash: hash,
          role: body.role,
        })
        .returning();
      return inserted;
    });
  } catch (err) {
    if (isSingleActiveTokenViolation(err)) {
      throw conflict('同一チームの有効なアクセストークンは 1 つのみです');
    }
    throw err;
  }
  if (!access) throw new Error('insert failed');

  const link = `${env.APP_ORIGIN}/team-access?token=${token}`;
  const delivery = await sendAccessLinkOrReturnRecovery(body.email, teamId, link);

  return c.json(
    {
      id: access.id,
      teamId: access.teamId,
      email: access.email,
      role: access.role,
      delivery,
    },
    201,
  );
});

// POST /api/team-accesses/:id/revoke - 編集リンク失効 (operator)
const revokeTeamAccess = createRoute({
  method: 'post',
  path: '/team-accesses/{id}/revoke',
  tags: ['team-accesses'],
  middleware: [requireOperator] as const,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: messageSchema } },
      description: '失効成功',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: '権限なし',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Not Found',
    },
  },
});
app.openapi(revokeTeamAccess, async (c) => {
  const { id } = c.req.valid('param');
  const [row] = await db
    .update(teamAccesses)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(teamAccesses.id, id))
    .returning();
  if (!row) throw notFound('チームアクセストークンが見つかりません');
  return c.json({ message: '失効しました' }, 200);
});

// POST /api/team-accesses/verify - チーム編集リンク認証 (public)
const verifyTeamLink = createRoute({
  method: 'post',
  path: '/team-accesses/verify',
  tags: ['auth'],
  middleware: [
    fixedWindowRateLimit({
      keyPrefix: 'team-access-verify',
      windowMs: 60_000,
      max: 10,
    }),
  ] as const,
  request: {
    body: {
      content: { 'application/json': { schema: VerifyTeamLinkSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: verifyResponseSchema } },
      description: '認証成功',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '無効なトークン',
    },
    429: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'レート制限',
    },
  },
});
app.openapi(verifyTeamLink, async (c) => {
  const { token } = c.req.valid('json');

  const hash = hashAccessToken(token);
  const access = await db.query.teamAccesses.findFirst({
    where: eq(teamAccesses.accessTokenHash, hash),
  });

  if (!access) throw unauthorized('無効なトークンです');
  if (!isTokenValid(access.revokedAt?.toISOString()))
    throw unauthorized('トークンは失効しています');
  if (!verifyAccessToken(token, access.accessTokenHash)) throw unauthorized('無効なトークンです');

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, access.teamId),
  });
  if (!team) throw unauthorized('対象チームが見つかりません');

  // last_used_at を更新
  await db
    .update(teamAccesses)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(teamAccesses.id, access.id));

  // 長期トークン本体ではなく、短期の署名済み Cookie を設定して権限を付与
  const maxAge = 60 * 60 * 24 * 7;
  const sessionCookie = createTeamAccessSessionCookie(
    {
      teamAccessId: access.id,
      teamId: access.teamId,
      tournamentId: team.tournamentId,
      role: access.role,
    },
    maxAge,
  );
  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax' as const,
    maxAge,
    path: '/',
  };
  setCookie(c, 'team_access_session', sessionCookie, cookieOptions);
  deleteCookie(c, 'team_access_token', { path: '/' });
  deleteCookie(c, 'team_access_id', { path: '/' });

  return c.json(
    {
      kind: 'team' as const,
      teamId: access.teamId,
      tournamentId: team.tournamentId,
      teamAccessId: access.id,
      role: access.role,
    },
    200,
  );
});

// GET /api/team-accesses/session - 現在のチームアクセス短期セッション確認 (public)
const getTeamAccessSession = createRoute({
  method: 'get',
  path: '/team-accesses/session',
  tags: ['auth'],
  responses: {
    200: {
      content: {
        'application/json': { schema: teamAccessSessionResponseSchema },
      },
      description: 'チームアクセス短期セッション',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
  },
});
app.openapi(getTeamAccessSession, async (c) => {
  const authCtx = c.get('auth');

  if (
    !authCtx.teamId ||
    !authCtx.teamTournamentId ||
    !authCtx.teamAccessRole ||
    !authCtx.teamAccessId
  ) {
    throw unauthorized();
  }

  return c.json(
    {
      teamId: authCtx.teamId,
      tournamentId: authCtx.teamTournamentId,
      teamAccessId: authCtx.teamAccessId,
      role: authCtx.teamAccessRole,
    },
    200,
  );
});

// DELETE /api/team-accesses/:id - チームアクセス削除 (operator)
const deleteTeamAccess = createRoute({
  method: 'delete',
  path: '/team-accesses/{id}',
  tags: ['team-accesses'],
  middleware: [requireOperator] as const,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: messageSchema } },
      description: '削除成功',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: '権限なし',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Not Found',
    },
  },
});
app.openapi(deleteTeamAccess, async (c) => {
  const { id } = c.req.valid('param');
  const existing = await db.query.teamAccesses.findFirst({
    where: eq(teamAccesses.id, id),
  });
  if (!existing) throw notFound('チームアクセストークンが見つかりません');
  await db.delete(teamAccesses).where(eq(teamAccesses.id, id));
  return c.json({ message: '削除しました' }, 200);
});

// POST /api/team-accesses/:id/resend - アクセスリンク再送信 (operator)
const resendTeamAccess = createRoute({
  method: 'post',
  path: '/team-accesses/{id}/resend',
  tags: ['team-accesses'],
  middleware: [requireOperator] as const,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: {
        'application/json': { schema: resendTeamAccessResponseSchema },
      },
      description: '再送信成功',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: '権限なし',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Not Found',
    },
    409: {
      content: { 'application/json': { schema: errorSchema } },
      description: '競合',
    },
  },
});
app.openapi(resendTeamAccess, async (c) => {
  const { id } = c.req.valid('param');
  const existing = await db.query.teamAccesses.findFirst({
    where: eq(teamAccesses.id, id),
  });
  if (!existing) throw notFound('チームアクセストークンが見つかりません');

  await findTeamOrThrow(existing.teamId);

  // 新しいトークンを発行してハッシュを更新
  const token = generateAccessToken();
  const hash = hashAccessToken(token);
  let access: TeamAccessRow | undefined;
  try {
    access = await db.transaction(async (tx) => {
      await tx
        .update(teamAccesses)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(teamAccesses.teamId, existing.teamId), isNull(teamAccesses.revokedAt)));

      const [inserted] = await tx
        .insert(teamAccesses)
        .values({
          teamId: existing.teamId,
          email: existing.email,
          accessTokenHash: hash,
          role: existing.role,
        })
        .returning();
      return inserted;
    });
  } catch (err) {
    if (isSingleActiveTokenViolation(err)) {
      throw conflict('同一チームの有効なアクセストークンは 1 つのみです');
    }
    throw err;
  }
  if (!access) throw new Error('insert failed');

  const link = `${env.APP_ORIGIN}/team-access?token=${token}`;
  const delivery = await sendAccessLinkOrReturnRecovery(existing.email, existing.teamId, link);

  return c.json({ message: '再送信しました', delivery }, 200);
});

export default app;
