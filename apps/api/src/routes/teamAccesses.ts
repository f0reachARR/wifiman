import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  CreateTeamAccessSchema,
  generateAccessToken,
  hashAccessToken,
  isTokenValid,
  VerifyTeamLinkSchema,
  verifyAccessToken,
} from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import type { ContextVariableMap } from 'hono';
import { setCookie } from 'hono/cookie';
import { db } from '../db/index.js';
import { teamAccesses } from '../db/schema/index.js';
import { env } from '../env.js';
import { notFound, unauthorized } from '../errors.js';
import { createMailer } from '../mailer/index.js';
import { requireOperator } from '../middleware/auth.js';

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

// GET /api/teams/:teamId/team-accesses - チームアクセス一覧 (operator)
const listTeamAccesses = createRoute({
  method: 'get',
  path: '/teams/{teamId}/team-accesses',
  tags: ['team-accesses'],
  middleware: [requireOperator] as const,
  request: { params: z.object({ teamId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(z.any()) } },
      description: 'チームアクセス一覧',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
  },
});
app.openapi(listTeamAccesses, async (c) => {
  const { teamId } = c.req.valid('param');
  const rows = await db.select().from(teamAccesses).where(eq(teamAccesses.teamId, teamId));
  // accessTokenHash は外部に露出しない
  return c.json(
    rows.map(({ accessTokenHash: _h, ...rest }) => rest),
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
        'application/json': { schema: CreateTeamAccessSchema.omit({ teamId: true }) },
      },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: z.any() } }, description: '編集リンク発行' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
  },
});
app.openapi(createTeamAccess, async (c) => {
  const { teamId } = c.req.valid('param');
  const body = c.req.valid('json');

  const token = generateAccessToken();
  const hash = hashAccessToken(token);

  const [access] = await db
    .insert(teamAccesses)
    .values({
      teamId,
      email: body.email,
      accessTokenHash: hash,
      role: body.role,
    })
    .returning();
  if (!access) throw new Error('insert failed');

  // メール送信 (失敗してもエラーにしない: ログのみ)
  const link = `${env.APP_ORIGIN}/team-access?token=${token}&id=${access.id}`;
  try {
    const mailer = createMailer();
    if (mailer) {
      await mailer.sendTeamAccessLink(body.email, teamId, link);
    }
  } catch (err) {
    console.error('チーム編集リンク送信失敗:', err);
  }

  return c.json(
    { id: access.id, teamId: access.teamId, email: access.email, role: access.role },
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
    200: { content: { 'application/json': { schema: z.any() } }, description: '失効成功' },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
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
  request: {
    body: { content: { 'application/json': { schema: VerifyTeamLinkSchema } }, required: true },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: '認証成功' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '無効なトークン',
    },
  },
});
app.openapi(verifyTeamLink, async (c) => {
  const { token } = c.req.valid('json');

  // トークンの前半16文字からアクセスIDを探す (全件スキャン回避のためハッシュで検索)
  const hash = hashAccessToken(token);
  const access = await db.query.teamAccesses.findFirst({
    where: eq(teamAccesses.accessTokenHash, hash),
  });

  if (!access) throw unauthorized('無効なトークンです');
  if (!isTokenValid(access.revokedAt?.toISOString()))
    throw unauthorized('トークンは失効しています');
  if (!verifyAccessToken(token, access.accessTokenHash)) throw unauthorized('無効なトークンです');

  // last_used_at を更新
  await db
    .update(teamAccesses)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(teamAccesses.id, access.id));

  // Cookie を設定して権限を付与
  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 日
    path: '/',
  };
  setCookie(c, 'team_access_token', token, cookieOptions);
  setCookie(c, 'team_access_id', access.id, cookieOptions);

  return c.json({ teamId: access.teamId, role: access.role }, 200);
});

// DELETE /api/team-accesses/:id - チームアクセス削除 (operator)
const deleteTeamAccess = createRoute({
  method: 'delete',
  path: '/team-accesses/{id}',
  tags: ['team-accesses'],
  middleware: [requireOperator] as const,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: '削除成功' },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
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
    200: { content: { 'application/json': { schema: z.any() } }, description: '再送信成功' },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(resendTeamAccess, async (c) => {
  const { id } = c.req.valid('param');
  const existing = await db.query.teamAccesses.findFirst({
    where: eq(teamAccesses.id, id),
  });
  if (!existing) throw notFound('チームアクセストークンが見つかりません');

  // 新しいトークンを発行してハッシュを更新
  const token = generateAccessToken();
  const hash = hashAccessToken(token);
  await db
    .update(teamAccesses)
    .set({ accessTokenHash: hash, revokedAt: null, updatedAt: new Date() })
    .where(eq(teamAccesses.id, id));

  const link = `${env.APP_ORIGIN}/team-access?token=${token}&id=${existing.id}`;
  try {
    const mailer = createMailer();
    if (mailer) {
      await mailer.sendTeamAccessLink(existing.email, existing.teamId, link);
    }
  } catch (err) {
    console.error('チーム編集リンク再送信失敗:', err);
  }

  return c.json({ message: '再送信しました' }, 200);
});

export default app;
