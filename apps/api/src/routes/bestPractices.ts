import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { CreateBestPracticeSchema, UpdateBestPracticeSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import type { ContextVariableMap } from 'hono';
import { db } from '../db/index.js';
import { bestPractices } from '../db/schema/index.js';
import { notFound } from '../errors.js';
import { requireOperator } from '../middleware/auth.js';

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

// GET /api/tournaments/:tournamentId/best-practices - ベストプラクティス一覧 (public)
const listBestPractices = createRoute({
  method: 'get',
  path: '/tournaments/{tournamentId}/best-practices',
  tags: ['best-practices'],
  request: { params: z.object({ tournamentId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(z.any()) } },
      description: 'ベストプラクティス一覧',
    },
  },
});
app.openapi(listBestPractices, async (c) => {
  const { tournamentId } = c.req.valid('param');
  const rows = await db
    .select()
    .from(bestPractices)
    .where(eq(bestPractices.tournamentId, tournamentId));
  return c.json(rows, 200);
});

// POST /api/best-practices - ベストプラクティス作成 (operator)
const createBestPractice = createRoute({
  method: 'post',
  path: '/best-practices',
  tags: ['best-practices'],
  middleware: [requireOperator] as const,
  request: {
    body: { content: { 'application/json': { schema: CreateBestPracticeSchema } }, required: true },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: z.any() } },
      description: 'ベストプラクティス作成',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
  },
});
app.openapi(createBestPractice, async (c) => {
  const body = c.req.valid('json');
  const [row] = await db.insert(bestPractices).values(body).returning();
  if (!row) throw new Error('insert failed');
  return c.json(row, 201);
});

// PATCH /api/best-practices/:id - ベストプラクティス更新 (operator)
const updateBestPractice = createRoute({
  method: 'patch',
  path: '/best-practices/{id}',
  tags: ['best-practices'],
  middleware: [requireOperator] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: UpdateBestPracticeSchema } }, required: true },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.any() } },
      description: 'ベストプラクティス更新',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(updateBestPractice, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const [row] = await db
    .update(bestPractices)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(bestPractices.id, id))
    .returning();
  if (!row) throw notFound('ベストプラクティスが見つかりません');
  return c.json(row, 200);
});

export default app;
