import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { CreateTeamSchema, UpdateTeamSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import type { ContextVariableMap } from 'hono';
import { db } from '../db/index.js';
import { teams } from '../db/schema/index.js';
import type { TeamRow } from '../db/schema/teams.js';
import { conflict, notFound } from '../errors.js';
import type { AuthContext } from '../middleware/auth.js';
import { requireOperator, requireParticipant, requireTeamEditor } from '../middleware/auth.js';
import { isTeamsNameUniqueViolation } from './teamErrors.js';

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const teamResponseSchema = z.object({
  id: z.string(),
  tournamentId: z.string(),
  name: z.string(),
  organization: z.string().nullable(),
  pitId: z.string().nullable(),
  contactEmail: z.string().nullable().optional(),
  displayContactName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
const publicTeamSchema = teamResponseSchema.omit({
  contactEmail: true,
  displayContactName: true,
  notes: true,
});
const listTeamResponseSchema = z.union([teamResponseSchema, publicTeamSchema]);
const deleteResponseSchema = z.object({ message: z.string() });

/**
 * contactEmail / displayContactName を自チームまたは運営者以外には非表示にする。
 */
function maskTeamFields(row: TeamRow, authCtx: AuthContext | undefined): object {
  if (authCtx?.userRole === 'operator') return row;
  if (authCtx?.teamId === row.id) return row;
  const { contactEmail: _ce, displayContactName: _dcn, notes: _n, ...publicFields } = row;
  return publicFields;
}

// GET /api/tournaments/:tournamentId/teams - チーム一覧 (public, 機微情報はマスク)
const listTeams = createRoute({
  method: 'get',
  path: '/tournaments/{tournamentId}/teams',
  tags: ['teams'],
  request: { params: z.object({ tournamentId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(listTeamResponseSchema) } },
      description: 'チーム一覧',
    },
  },
});
app.openapi(listTeams, async (c) => {
  const { tournamentId } = c.req.valid('param');
  const authCtx = c.get('auth');
  const rows = await db.select().from(teams).where(eq(teams.tournamentId, tournamentId));
  return c.json(
    rows.map((r) => maskTeamFields(r, authCtx)),
    200,
  );
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
    201: {
      content: { 'application/json': { schema: teamResponseSchema } },
      description: 'チーム作成',
    },
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
    if (isTeamsNameUniqueViolation(err)) {
      throw conflict('同じ大会にすでに同名のチームが存在します');
    }
    throw err;
  }
});

// GET /api/teams/:id - チーム詳細 (participant, 機微情報はマスク)
const getTeam = createRoute({
  method: 'get',
  path: '/teams/{teamId}',
  tags: ['teams'],
  middleware: [requireParticipant] as const,
  request: { params: z.object({ teamId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: listTeamResponseSchema } },
      description: 'チーム詳細',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(getTeam, async (c) => {
  const { teamId } = c.req.valid('param');
  const authCtx = c.get('auth');
  const row = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!row) throw notFound('チームが見つかりません');
  return c.json(maskTeamFields(row, authCtx), 200);
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
    200: {
      content: { 'application/json': { schema: teamResponseSchema } },
      description: 'チーム更新',
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

// DELETE /api/teams/:teamId - チーム削除 (operator)
const deleteTeam = createRoute({
  method: 'delete',
  path: '/teams/{teamId}',
  tags: ['teams'],
  middleware: [requireOperator] as const,
  request: { params: z.object({ teamId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: deleteResponseSchema } },
      description: '削除成功',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(deleteTeam, async (c) => {
  const { teamId } = c.req.valid('param');
  const existing = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!existing) throw notFound('チームが見つかりません');
  await db.delete(teams).where(eq(teams.id, teamId));
  return c.json({ message: '削除しました' }, 200);
});

export default app;
