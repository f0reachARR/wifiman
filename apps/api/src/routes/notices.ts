import { zValidator } from '@hono/zod-validator';
import { CreateNoticeSchema, UpdateNoticeSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { notices } from '../db/schema/index.js';
import { notFound } from '../errors.js';
import { requireOperator } from '../middleware/auth.js';

const app = new Hono();

// GET /api/tournaments/:tournamentId/notices - お知らせ一覧 (public)
app.get('/tournaments/:tournamentId/notices', async (c) => {
  const { tournamentId } = c.req.param();
  const rows = await db.select().from(notices).where(eq(notices.tournamentId, tournamentId));
  return c.json(rows);
});

// POST /api/tournaments/:tournamentId/notices - お知らせ作成 (operator)
app.post(
  '/tournaments/:tournamentId/notices',
  requireOperator,
  zValidator('json', CreateNoticeSchema.omit({ tournamentId: true })),
  async (c) => {
    const { tournamentId } = c.req.param();
    const body = c.req.valid('json');
    const { publishedAt: publishedAtStr, expiresAt: expiresAtStr, ...restBody } = body;
    const [row] = await db
      .insert(notices)
      .values({
        ...restBody,
        tournamentId,
        publishedAt: new Date(publishedAtStr),
        ...(expiresAtStr !== undefined ? { expiresAt: new Date(expiresAtStr) } : {}),
      })
      .returning();
    if (!row) throw new Error('insert failed');
    return c.json(row, 201);
  },
);

// PATCH /api/notices/:id - お知らせ更新 (operator)
app.patch('/notices/:id', requireOperator, zValidator('json', UpdateNoticeSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const { publishedAt: publishedAtStr, expiresAt: expiresAtStr, ...restBody } = body;
  const updateData = {
    ...restBody,
    ...(publishedAtStr !== undefined ? { publishedAt: new Date(publishedAtStr) } : {}),
    ...(expiresAtStr !== undefined ? { expiresAt: new Date(expiresAtStr) } : {}),
  };
  const [row] = await db.update(notices).set(updateData).where(eq(notices.id, id)).returning();
  if (!row) throw notFound('お知らせが見つかりません');
  return c.json(row);
});

export default app;
