import { zValidator } from '@hono/zod-validator';
import { CreateTeamSchema, UpdateTeamSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { teams } from '../db/schema/index.js';
import { conflict, notFound } from '../errors.js';
import { requireOperator, requireTeamEditor, requireTeamViewer } from '../middleware/auth.js';

const app = new Hono();

// GET /api/tournaments/:tournamentId/teams - チーム一覧 (public)
app.get('/tournaments/:tournamentId/teams', async (c) => {
  const { tournamentId } = c.req.param();
  const rows = await db.select().from(teams).where(eq(teams.tournamentId, tournamentId));
  return c.json(rows);
});

// POST /api/tournaments/:tournamentId/teams - チーム作成 (operator)
app.post(
  '/tournaments/:tournamentId/teams',
  requireOperator,
  zValidator('json', CreateTeamSchema.omit({ tournamentId: true })),
  async (c) => {
    const { tournamentId } = c.req.param();
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
  },
);

// GET /api/teams/:id - チーム詳細 (team_viewer)
app.get('/teams/:teamId', requireTeamViewer('teamId'), async (c) => {
  const id = c.req.param('teamId')!;
  const row = await db.query.teams.findFirst({ where: eq(teams.id, id) });
  if (!row) throw notFound('チームが見つかりません');
  return c.json(row);
});

// PATCH /api/teams/:id - チーム更新 (team_editor)
app.patch(
  '/teams/:teamId',
  requireTeamEditor('teamId'),
  zValidator('json', UpdateTeamSchema),
  async (c) => {
    const id = c.req.param('teamId')!;
    const body = c.req.valid('json');
    const [row] = await db
      .update(teams)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();
    if (!row) throw notFound('チームが見つかりません');
    return c.json(row);
  },
);

export default app;
