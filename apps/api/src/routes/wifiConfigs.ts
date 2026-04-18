import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { Band, ChannelWidth, WifiConfigStatus } from '@wifiman/shared';
import {
  CreateWifiConfigSchema,
  canActivateWifiConfig,
  canAddWifiConfig,
  isValidChannel,
  isValidChannelWidth,
  UpdateWifiConfigSchema,
} from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import type { ContextVariableMap, MiddlewareHandler } from 'hono';
import { db } from '../db/index.js';
import { deviceSpecs, wifiConfigs } from '../db/schema/index.js';
import { notFound, unprocessable } from '../errors.js';
import { requireTeamEditor, requireTeamViewer } from '../middleware/auth.js';

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const wifiConfigResponseSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  purpose: z.enum(['control', 'video', 'debug', 'other']),
  band: z.enum(['2.4GHz', '5GHz', '6GHz']),
  channel: z.number().int(),
  channelWidthMHz: z.number().int(),
  role: z.enum(['primary', 'backup']),
  status: z.enum(['active', 'standby', 'disabled']),
  apDeviceId: z.string().nullable(),
  clientDeviceId: z.string().nullable(),
  expectedDistanceCategory: z.enum(['near', 'mid', 'far']).nullable(),
  pingTargetIp: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
const publicWifiConfigResponseSchema = wifiConfigResponseSchema.omit({
  pingTargetIp: true,
  notes: true,
});
const deleteResponseSchema = z.object({ message: z.string() });
type AppMiddleware = MiddlewareHandler<{ Variables: ContextVariableMap }>;

function toPublicWifiConfig(
  row: z.infer<typeof wifiConfigResponseSchema>,
): z.infer<typeof publicWifiConfigResponseSchema> {
  const { pingTargetIp: _pingTargetIp, notes: _notes, ...publicRow } = row;
  return publicRow;
}

async function assertDeviceBelongsToTeam(
  teamId: string,
  deviceId: string | undefined,
  label: 'AP' | 'クライアント',
) {
  if (!deviceId) return;
  const device = await db.query.deviceSpecs.findFirst({ where: eq(deviceSpecs.id, deviceId) });
  if (!device) {
    throw unprocessable(`指定された ${label} 機材が見つかりません`);
  }
  if (device.teamId !== teamId) {
    throw unprocessable(`他チームの ${label} 機材は指定できません`);
  }
}

const resolveWifiConfigTeamMiddleware: AppMiddleware = async (c, next) => {
  const id = c.req.param('id') as string;
  const config = await db.query.wifiConfigs.findFirst({ where: eq(wifiConfigs.id, id) });
  if (!config) throw notFound('WiFi 構成が見つかりません');
  c.set('_targetTeamId', config.teamId);
  await next();
};

function validateChannelAndWidth(band: Band, channel: number, widthMHz: number) {
  if (!isValidChannel(band, channel)) {
    throw unprocessable(`帯域 ${band} に対してチャンネル ${channel} は無効です`);
  }
  if (!isValidChannelWidth(band, widthMHz as ChannelWidth)) {
    throw unprocessable(`帯域 ${band} に対してチャンネル幅 ${widthMHz}MHz は無効です`);
  }
}

// GET /api/teams/:teamId/wifi-configs - WiFi 構成一覧 (team_viewer)
const listWifiConfigs = createRoute({
  method: 'get',
  path: '/teams/{teamId}/wifi-configs',
  tags: ['wifi-configs'],
  middleware: [requireTeamViewer('teamId')] as const,
  request: { params: z.object({ teamId: z.string() }) },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(z.union([wifiConfigResponseSchema, publicWifiConfigResponseSchema])),
        },
      },
      description: 'WiFi 構成一覧',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
  },
});
app.openapi(listWifiConfigs, async (c) => {
  const { teamId } = c.req.valid('param');
  const authCtx = c.get('auth');
  const rows = await db.select().from(wifiConfigs).where(eq(wifiConfigs.teamId, teamId));
  if (authCtx?.userRole === 'operator' || authCtx?.teamId === teamId) {
    return c.json(rows, 200);
  }
  return c.json(
    rows.map((row) => toPublicWifiConfig(row)),
    200,
  );
});

// POST /api/teams/:teamId/wifi-configs - WiFi 構成作成 (team_editor)
const createWifiConfig = createRoute({
  method: 'post',
  path: '/teams/{teamId}/wifi-configs',
  tags: ['wifi-configs'],
  middleware: [requireTeamEditor('teamId')] as const,
  request: {
    params: z.object({ teamId: z.string() }),
    body: {
      content: { 'application/json': { schema: CreateWifiConfigSchema.omit({ teamId: true }) } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: wifiConfigResponseSchema } },
      description: 'WiFi 構成作成',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    422: { content: { 'application/json': { schema: errorSchema } }, description: '処理不能' },
  },
});
app.openapi(createWifiConfig, async (c) => {
  const { teamId } = c.req.valid('param');
  const body = c.req.valid('json');

  // チャンネル・幅の検証
  validateChannelAndWidth(body.band, body.channel, body.channelWidthMHz);

  await assertDeviceBelongsToTeam(teamId, body.apDeviceId, 'AP');
  await assertDeviceBelongsToTeam(teamId, body.clientDeviceId, 'クライアント');

  // 3 件上限チェック (active + standby のみカウント)
  if (body.status !== 'disabled') {
    const existing = await db
      .select({ status: wifiConfigs.status })
      .from(wifiConfigs)
      .where(eq(wifiConfigs.teamId, teamId));
    if (!canAddWifiConfig(existing)) {
      throw unprocessable('WiFi 構成は最大 3 件 (active + standby) までです');
    }
  }

  const [row] = await db
    .insert(wifiConfigs)
    .values({ ...body, teamId })
    .returning();
  if (!row) throw new Error('insert failed');
  return c.json(row, 201);
});

// PATCH /api/wifi-configs/:id - WiFi 構成更新 (team_editor)
const patchWifiConfig = createRoute({
  method: 'patch',
  path: '/wifi-configs/{id}',
  tags: ['wifi-configs'],
  middleware: [resolveWifiConfigTeamMiddleware, requireTeamEditor('teamId')] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: UpdateWifiConfigSchema } }, required: true },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: wifiConfigResponseSchema } },
      description: 'WiFi 構成更新',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
    422: { content: { 'application/json': { schema: errorSchema } }, description: '処理不能' },
  },
});
app.openapi(patchWifiConfig, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');

  const existing = await db.query.wifiConfigs.findFirst({ where: eq(wifiConfigs.id, id) });
  if (!existing) throw notFound('WiFi 構成が見つかりません');

  const newBand = body.band ?? existing.band;
  const newChannel = body.channel ?? existing.channel;
  const newWidth = body.channelWidthMHz ?? existing.channelWidthMHz;

  if (body.band !== undefined || body.channel !== undefined || body.channelWidthMHz !== undefined) {
    validateChannelAndWidth(newBand, newChannel, newWidth);
  }

  await assertDeviceBelongsToTeam(existing.teamId, body.apDeviceId, 'AP');
  await assertDeviceBelongsToTeam(existing.teamId, body.clientDeviceId, 'クライアント');

  // ステータス変更時の上限チェック
  if (body.status !== undefined && body.status !== 'disabled') {
    const allConfigs = await db
      .select({ status: wifiConfigs.status, id: wifiConfigs.id })
      .from(wifiConfigs)
      .where(eq(wifiConfigs.teamId, existing.teamId));
    if (
      !canActivateWifiConfig(
        allConfigs as Array<{ id: string; status: WifiConfigStatus }>,
        id,
        body.status,
      )
    ) {
      throw unprocessable('WiFi 構成は最大 3 件 (active + standby) までです');
    }
  }

  const [row] = await db
    .update(wifiConfigs)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(wifiConfigs.id, id))
    .returning();
  if (!row) throw notFound('WiFi 構成が見つかりません');
  return c.json(row, 200);
});

// DELETE /api/wifi-configs/:id - WiFi 構成削除 (team_editor)
const deleteWifiConfig = createRoute({
  method: 'delete',
  path: '/wifi-configs/{id}',
  tags: ['wifi-configs'],
  middleware: [resolveWifiConfigTeamMiddleware, requireTeamEditor('teamId')] as const,
  request: { params: z.object({ id: z.string() }) },
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
app.openapi(deleteWifiConfig, async (c) => {
  const { id } = c.req.valid('param');
  const [row] = await db.delete(wifiConfigs).where(eq(wifiConfigs.id, id)).returning();
  if (!row) throw notFound('WiFi 構成が見つかりません');
  return c.json({ message: '削除しました' }, 200);
});

export default app;
