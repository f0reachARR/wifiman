import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { CreateTeamSchema, UpdateTeamSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import type { ContextVariableMap } from 'hono';
import { db } from '../db/index.js';
import { teams } from '../db/schema/index.js';
import { conflict, notFound } from '../errors.js';
import { requireOperator, requireTeamEditor, requireTeamViewer } from '../middleware/auth.js';

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

// GET /api/tournaments/:tournamentId/teams - チーム一覧 (public)
const listTeams = createRoute({
  method: 'get',
  path: '/tournaments/{tournamentId}/teams',
  tags: ['teams'],
  request: { params: z.object({ tournamentId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(z.any()) } },
      description: 'チーム一覧',
    },
  },
});
app.openapi(listTeams, async (c) => {
  const { tournamentId } = c.req.valid('param');
  const rows = await db.select().from(teams).where(eq(teams.tournamentId, tournamentId));
  return c.json(rows, 200);
});

// POST /api/tournaments/:tournamentId/teams - チーム作成 (operator)
const createTeam = createRoute({
  method: 'post',
  path: '/tournaments/{tournamentId}/teams',
  tags: ['teams'],
  middleware: [requireOperator] as const,
  request: {
    params: z.object({ tournamentId: z.string() }),
    body: {
      content: { 'application/json': { schema: CreateTeamSchema.omit({ tournamentId: true }) } },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: z.any() } }, description: 'チーム作成' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    409: { content: { 'application/json': { schema: errorSchema } }, description: '競合' },
  },
});
app.openapi(createTeam, async (c) => {
  const { tournamentId } = c.req.valid('param');
  const body = c.req.valid('json');
  try {
    const [row] = await db
      .insert(teams)
      .values({ ...body, tournamentId })
      .returning();
    if (!row) throw new Error('insert failed');
    return c.json(row, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('teams_tournament_name_unique')) {
      throw conflict('同じ大会にすでに同名のチームが存在します');
    }
    throw err;
  }
});

// GET /api/teams/:id - チーム詳細 (team_viewer)
const getTeam = createRoute({
  method: 'get',
  path: '/teams/{teamId}',
  tags: ['teams'],
  middleware: [requireTeamViewer('teamId')] as const,
  request: { params: z.object({ teamId: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: 'チーム詳細' },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(getTeam, async (c) => {
  const { teamId } = c.req.valid('param');
  const row = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!row) throw notFound('チームが見つかりません');
  return c.json(row, 200);
});

// PATCH /api/teams/:id - チーム更新 (team_editor)
const updateTeam = createRoute({
  method: 'patch',
  path: '/teams/{teamId}',
  tags: ['teams'],
  middleware: [requireTeamEditor('teamId')] as const,
  request: {
    params: z.object({ teamId: z.string() }),
    body: { content: { 'application/json': { schema: UpdateTeamSchema } }, required: true },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: 'チーム更新' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(updateTeam, async (c) => {
  const { teamId } = c.req.valid('param');
  const body = c.req.valid('json');
  const [row] = await db
    .update(teams)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(teams.id, teamId))
    .returning();
  if (!row) throw notFound('チームが見つかりません');
  return c.json(row, 200);
});

export default app;
