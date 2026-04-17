import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { CreateDeviceSpecSchema, UpdateDeviceSpecSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import type { ContextVariableMap, MiddlewareHandler } from 'hono';
import { db } from '../db/index.js';
import { deviceSpecs } from '../db/schema/index.js';
import { notFound } from '../errors.js';
import { requireTeamEditor, requireTeamViewer } from '../middleware/auth.js';

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
type AppMiddleware = MiddlewareHandler<{ Variables: ContextVariableMap }>;

const resolveDeviceSpecTeamMiddleware: AppMiddleware = async (c, next) => {
  const id = c.req.param('id') as string;
  const spec = await db.query.deviceSpecs.findFirst({ where: eq(deviceSpecs.id, id) });
  if (!spec) throw notFound('機材仕様が見つかりません');
  c.set('_targetTeamId', spec.teamId);
  await next();
};

// GET /api/teams/:teamId/device-specs - 機材仕様一覧 (team_viewer)
const listDeviceSpecs = createRoute({
  method: 'get',
  path: '/teams/{teamId}/device-specs',
  tags: ['device-specs'],
  middleware: [requireTeamViewer('teamId')] as const,
  request: { params: z.object({ teamId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(z.any()) } },
      description: '機材仕様一覧',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
  },
});
app.openapi(listDeviceSpecs, async (c) => {
  const { teamId } = c.req.valid('param');
  const rows = await db.select().from(deviceSpecs).where(eq(deviceSpecs.teamId, teamId));
  // supportedBands は JSON 文字列として保存されているため parse する
  return c.json(
    rows.map((r) => ({
      ...r,
      supportedBands: JSON.parse(r.supportedBands) as string[],
    })),
    200,
  );
});

// POST /api/teams/:teamId/device-specs - 機材仕様作成 (team_editor)
const createDeviceSpec = createRoute({
  method: 'post',
  path: '/teams/{teamId}/device-specs',
  tags: ['device-specs'],
  middleware: [requireTeamEditor('teamId')] as const,
  request: {
    params: z.object({ teamId: z.string() }),
    body: {
      content: { 'application/json': { schema: CreateDeviceSpecSchema.omit({ teamId: true }) } },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: z.any() } }, description: '機材仕様作成' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
  },
});
app.openapi(createDeviceSpec, async (c) => {
  const { teamId } = c.req.valid('param');
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
});

// PATCH /api/device-specs/:id - 機材仕様更新 (team_editor)
const patchDeviceSpec = createRoute({
  method: 'patch',
  path: '/device-specs/{id}',
  tags: ['device-specs'],
  middleware: [resolveDeviceSpecTeamMiddleware, requireTeamEditor('teamId')] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: UpdateDeviceSpecSchema } }, required: true },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: '機材仕様更新' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(patchDeviceSpec, async (c) => {
  const { id } = c.req.valid('param');
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
  return c.json(
    {
      ...row,
      supportedBands: body.supportedBands ?? JSON.parse(row.supportedBands),
    },
    200,
  );
});

export default app;
