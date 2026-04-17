import { zValidator } from '@hono/zod-validator';
import { CreateDeviceSpecSchema, UpdateDeviceSpecSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { deviceSpecs } from '../db/schema/index.js';
import { notFound } from '../errors.js';
import { requireTeamEditor, requireTeamViewer } from '../middleware/auth.js';

const app = new Hono();

// GET /api/teams/:teamId/device-specs - 機材仕様一覧 (team_viewer)
app.get('/teams/:teamId/device-specs', requireTeamViewer('teamId'), async (c) => {
  const teamId = c.req.param('teamId')!;
  const rows = await db.select().from(deviceSpecs).where(eq(deviceSpecs.teamId, teamId));
  // supportedBands は JSON 文字列として保存されているため parse する
  return c.json(
    rows.map((r) => ({
      ...r,
      supportedBands: JSON.parse(r.supportedBands) as string[],
    })),
  );
});

// POST /api/teams/:teamId/device-specs - 機材仕様作成 (team_editor)
app.post(
  '/teams/:teamId/device-specs',
  requireTeamEditor('teamId'),
  zValidator('json', CreateDeviceSpecSchema.omit({ teamId: true })),
  async (c) => {
    const teamId = c.req.param('teamId')!;
    const body = c.req.valid('json');
    const [row] = await db
      .insert(deviceSpecs)
      .values({
        ...body,
        teamId,
        supportedBands: JSON.stringify(body.supportedBands),
      })
      .returning();
    if (!row) throw new Error('insert failed');
    return c.json({ ...row, supportedBands: body.supportedBands }, 201);
  },
);

// PATCH /api/device-specs/:id - 機材仕様更新 (team_editor)
app.patch(
  '/device-specs/:id',
  async (c, next) => {
    const id = c.req.param('id')!;
    const spec = await db.query.deviceSpecs.findFirst({ where: eq(deviceSpecs.id, id) });
    if (!spec) throw notFound('機材仕様が見つかりません');
    c.set('_targetTeamId', spec.teamId);
    await next();
  },
  requireTeamEditor('teamId'),
  zValidator('json', UpdateDeviceSpecSchema),
  async (c) => {
    const id = c.req.param('id')!;
    const body = c.req.valid('json');
    const { supportedBands: supportedBandsArr, ...restBody } = body;
    const updateData = {
      ...restBody,
      ...(supportedBandsArr !== undefined
        ? { supportedBands: JSON.stringify(supportedBandsArr) }
        : {}),
      updatedAt: new Date(),
    };
    const [row] = await db
      .update(deviceSpecs)
      .set(updateData)
      .where(eq(deviceSpecs.id, id))
      .returning();
    if (!row) throw notFound('機材仕様が見つかりません');
    return c.json({
      ...row,
      supportedBands: body.supportedBands ?? JSON.parse(row.supportedBands),
    });
  },
);

export default app;
