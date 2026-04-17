import { zValidator } from '@hono/zod-validator';
import { CreateTournamentSchema, UpdateTournamentSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { tournaments } from '../db/schema/index.js';
import { notFound } from '../errors.js';
import { requireOperator } from '../middleware/auth.js';

const app = new Hono();

// GET /api/tournaments - 大会一覧 (public)
app.get('/', async (c) => {
  const rows = await db.select().from(tournaments).orderBy(tournaments.startDate);
  return c.json(rows);
});

// POST /api/tournaments - 大会作成 (operator)
app.post('/', requireOperator, zValidator('json', CreateTournamentSchema), async (c) => {
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
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) });
  if (!row) throw notFound('大会が見つかりません');
  return c.json(row);
});

// PATCH /api/tournaments/:id - 大会更新 (operator)
app.patch('/:id', requireOperator, zValidator('json', UpdateTournamentSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const [row] = await db
    .update(tournaments)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(tournaments.id, id))
    .returning();
  if (!row) throw notFound('大会が見つかりません');
  return c.json(row);
});

export default app;
