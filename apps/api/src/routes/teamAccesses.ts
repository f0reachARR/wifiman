import { zValidator } from '@hono/zod-validator';
import {
  CreateTeamAccessSchema,
  generateAccessToken,
  hashAccessToken,
  isTokenValid,
  VerifyTeamLinkSchema,
  verifyAccessToken,
} from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { db } from '../db/index.js';
import { teamAccesses } from '../db/schema/index.js';
import { env } from '../env.js';
import { notFound, unauthorized } from '../errors.js';
import { createMailer } from '../mailer/index.js';
import { requireOperator } from '../middleware/auth.js';

const app = new Hono();

// POST /api/teams/:teamId/team-accesses - 編集リンク発行 (operator)
app.post(
  '/teams/:teamId/team-accesses',
  requireOperator,
  zValidator('json', CreateTeamAccessSchema.omit({ teamId: true })),
  async (c) => {
    const teamId = c.req.param('teamId');
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
      { id: access.id, teamId: access.teamId, email: access.email, role: access.role, link },
      201,
    );
  },
);

// POST /api/team-accesses/:id/revoke - 編集リンク失効 (operator)
app.post('/team-accesses/:id/revoke', requireOperator, async (c) => {
  const id = c.req.param('id')!;
  const [row] = await db
    .update(teamAccesses)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(teamAccesses.id, id))
    .returning();
  if (!row) throw notFound('チームアクセストークンが見つかりません');
  return c.json({ message: '失効しました' });
});

// POST /api/auth/team-link - チーム編集リンク認証 (public)
app.post('/auth/team-link', zValidator('json', VerifyTeamLinkSchema), async (c) => {
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
    maxAge: 60 * 60 * 24 * 30, // 30 日
    path: '/',
  };
  setCookie(c, 'team_access_token', token, cookieOptions);
  setCookie(c, 'team_access_id', access.id, cookieOptions);

  return c.json({ teamId: access.teamId, role: access.role });
});

export default app;
