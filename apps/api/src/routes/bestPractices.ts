import { zValidator } from '@hono/zod-validator';
import { CreateBestPracticeSchema, UpdateBestPracticeSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { bestPractices } from '../db/schema/index.js';
import { notFound } from '../errors.js';
import { requireOperator } from '../middleware/auth.js';

const app = new Hono();

// GET /api/tournaments/:tournamentId/best-practices - ベストプラクティス一覧 (public)
app.get('/tournaments/:tournamentId/best-practices', async (c) => {
  const { tournamentId } = c.req.param();
  const rows = await db
    .select()
    .from(bestPractices)
    .where(eq(bestPractices.tournamentId, tournamentId));
  return c.json(rows);
});

// POST /api/best-practices - ベストプラクティス作成 (operator)
app.post(
  '/best-practices',
  requireOperator,
  zValidator('json', CreateBestPracticeSchema),
  async (c) => {
    const body = c.req.valid('json');
    const [row] = await db.insert(bestPractices).values(body).returning();
    if (!row) throw new Error('insert failed');
    return c.json(row, 201);
  },
);

// PATCH /api/best-practices/:id - ベストプラクティス更新 (operator)
app.patch(
  '/best-practices/:id',
  requireOperator,
  zValidator('json', UpdateBestPracticeSchema),
  async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const [row] = await db
      .update(bestPractices)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(bestPractices.id, id))
      .returning();
    if (!row) throw notFound('ベストプラクティスが見つかりません');
    return c.json(row);
  },
);

export default app;
