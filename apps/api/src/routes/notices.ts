import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { CreateNoticeSchema, UpdateNoticeSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import type { ContextVariableMap } from 'hono';
import { db } from '../db/index.js';
import { notices } from '../db/schema/index.js';
import { notFound } from '../errors.js';
import { requireOperator } from '../middleware/auth.js';

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

// GET /api/tournaments/:tournamentId/notices - お知らせ一覧 (public)
const listNotices = createRoute({
  method: 'get',
  path: '/tournaments/{tournamentId}/notices',
  tags: ['notices'],
  request: { params: z.object({ tournamentId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(z.any()) } },
      description: 'お知らせ一覧',
    },
  },
});
app.openapi(listNotices, async (c) => {
  const { tournamentId } = c.req.valid('param');
  const rows = await db.select().from(notices).where(eq(notices.tournamentId, tournamentId));
  return c.json(rows, 200);
});

// POST /api/tournaments/:tournamentId/notices - お知らせ作成 (operator)
const createNotice = createRoute({
  method: 'post',
  path: '/tournaments/{tournamentId}/notices',
  tags: ['notices'],
  middleware: [requireOperator] as const,
  request: {
    params: z.object({ tournamentId: z.string() }),
    body: {
      content: { 'application/json': { schema: CreateNoticeSchema.omit({ tournamentId: true }) } },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: z.any() } }, description: 'お知らせ作成' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
  },
});
app.openapi(createNotice, async (c) => {
  const { tournamentId } = c.req.valid('param');
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
});

// PATCH /api/notices/:id - お知らせ更新 (operator)
const updateNotice = createRoute({
  method: 'patch',
  path: '/notices/{id}',
  tags: ['notices'],
  middleware: [requireOperator] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: UpdateNoticeSchema } }, required: true },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: 'お知らせ更新' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(updateNotice, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const { publishedAt: publishedAtStr, expiresAt: expiresAtStr, ...restBody } = body;
  const updateData = {
    ...restBody,
    ...(publishedAtStr !== undefined ? { publishedAt: new Date(publishedAtStr) } : {}),
    ...(expiresAtStr !== undefined ? { expiresAt: new Date(expiresAtStr) } : {}),
  };
  const [row] = await db.update(notices).set(updateData).where(eq(notices.id, id)).returning();
  if (!row) throw notFound('お知らせが見つかりません');
  return c.json(row, 200);
});

export default app;
