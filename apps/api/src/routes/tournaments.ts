import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { CreateTournamentSchema, UpdateTournamentSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import type { ContextVariableMap } from 'hono';
import { db } from '../db/index.js';
import { tournaments } from '../db/schema/index.js';
import { notFound } from '../errors.js';
import { requireOperator } from '../middleware/auth.js';

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const idParam = z.object({ id: z.string() });

// GET /api/tournaments - 大会一覧 (public)
const listTournaments = createRoute({
  method: 'get',
  path: '/tournaments',
  tags: ['tournaments'],
  responses: {
    200: { content: { 'application/json': { schema: z.array(z.any()) } }, description: '大会一覧' },
  },
});
app.openapi(listTournaments, async (c) => {
  const rows = await db.select().from(tournaments).orderBy(tournaments.startDate);
  return c.json(rows, 200);
});

// POST /api/tournaments - 大会作成 (operator)
const createTournament = createRoute({
  method: 'post',
  path: '/tournaments',
  tags: ['tournaments'],
  middleware: [requireOperator] as const,
  request: {
    body: { content: { 'application/json': { schema: CreateTournamentSchema } }, required: true },
  },
  responses: {
    201: { content: { 'application/json': { schema: z.any() } }, description: '大会作成' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
  },
});
app.openapi(createTournament, async (c) => {
  const body = c.req.valid('json');
  const [row] = await db
    .insert(tournaments)
    .values({
      name: body.name,
      venueName: body.venueName,
      startDate: body.startDate,
      endDate: body.endDate,
      description: body.description,
    })
    .returning();
  if (!row) throw new Error('insert failed');
  return c.json(row, 201);
});

// GET /api/tournaments/:id - 大会詳細 (public)
const getTournament = createRoute({
  method: 'get',
  path: '/tournaments/{id}',
  tags: ['tournaments'],
  request: { params: idParam },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: '大会詳細' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(getTournament, async (c) => {
  const { id } = c.req.valid('param');
  const row = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) });
  if (!row) throw notFound('大会が見つかりません');
  return c.json(row, 200);
});

// PATCH /api/tournaments/:id - 大会更新 (operator)
const updateTournament = createRoute({
  method: 'patch',
  path: '/tournaments/{id}',
  tags: ['tournaments'],
  middleware: [requireOperator] as const,
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: UpdateTournamentSchema } }, required: true },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: '大会更新' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(updateTournament, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const [row] = await db
    .update(tournaments)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(tournaments.id, id))
    .returning();
  if (!row) throw notFound('大会が見つかりません');
  return c.json(row, 200);
});

export default app;
