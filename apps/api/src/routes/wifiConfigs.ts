import { zValidator } from '@hono/zod-validator';
import type { ChannelWidth, WifiConfigStatus } from '@wifiman/shared';
import {
  CreateWifiConfigSchema,
  canActivateWifiConfig,
  canAddWifiConfig,
  isValidChannel,
  isValidChannelWidth,
  UpdateWifiConfigSchema,
} from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { wifiConfigs } from '../db/schema/index.js';
import { notFound, unprocessable } from '../errors.js';
import { requireTeamEditor, requireTeamViewer } from '../middleware/auth.js';

const app = new Hono();

function validateChannelAndWidth(
  band: 'band_placeholder' | '2.4GHz' | '5GHz' | '6GHz',
  channel: number,
  widthMHz: number,
) {
  const b = band as '2.4GHz' | '5GHz' | '6GHz';
  if (!isValidChannel(b, channel)) {
    throw unprocessable(`帯域 ${band} に対してチャンネル ${channel} は無効です`);
  }
  if (!isValidChannelWidth(b, widthMHz as ChannelWidth)) {
    throw unprocessable(`帯域 ${band} に対してチャンネル幅 ${widthMHz}MHz は無効です`);
  }
}

// GET /api/teams/:teamId/wifi-configs - WiFi 構成一覧 (team_viewer)
app.get('/teams/:teamId/wifi-configs', requireTeamViewer('teamId'), async (c) => {
  const teamId = c.req.param('teamId')!;
  const rows = await db.select().from(wifiConfigs).where(eq(wifiConfigs.teamId, teamId));
  return c.json(rows);
});

// POST /api/teams/:teamId/wifi-configs - WiFi 構成作成 (team_editor)
app.post(
  '/teams/:teamId/wifi-configs',
  requireTeamEditor('teamId'),
  zValidator('json', CreateWifiConfigSchema.omit({ teamId: true })),
  async (c) => {
    const teamId = c.req.param('teamId')!;
    const body = c.req.valid('json');

    // チャンネル・幅の検証
    validateChannelAndWidth(body.band, body.channel, body.channelWidthMHz);

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
  },
);

// PATCH /api/wifi-configs/:id - WiFi 構成更新 (team_editor)
app.patch(
  '/wifi-configs/:id',
  async (c, next) => {
    // teamId を wifiConfigs から取得して team_editor チェックに使う
    const id = c.req.param('id')!;
    const config = await db.query.wifiConfigs.findFirst({ where: eq(wifiConfigs.id, id) });
    if (!config) throw notFound('WiFi 構成が見つかりません');
    // teamId を param として上書き (ミドルウェアが c.req.param('teamId') を期待するため)
    c.set('_targetTeamId', config.teamId);
    await next();
  },
  requireTeamEditor('teamId'),
  zValidator('json', UpdateWifiConfigSchema),
  async (c) => {
    const id = c.req.param('id')!;
    const body = c.req.valid('json');

    const existing = await db.query.wifiConfigs.findFirst({ where: eq(wifiConfigs.id, id) });
    if (!existing) throw notFound('WiFi 構成が見つかりません');

    const newBand = body.band ?? existing.band;
    const newChannel = body.channel ?? existing.channel;
    const newWidth = body.channelWidthMHz ?? existing.channelWidthMHz;

    if (
      body.band !== undefined ||
      body.channel !== undefined ||
      body.channelWidthMHz !== undefined
    ) {
      validateChannelAndWidth(newBand, newChannel, newWidth);
    }

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
    return c.json(row);
  },
);

// DELETE /api/wifi-configs/:id - WiFi 構成削除 (team_editor)
app.delete(
  '/wifi-configs/:id',
  async (c, next) => {
    const id = c.req.param('id')!;
    const config = await db.query.wifiConfigs.findFirst({ where: eq(wifiConfigs.id, id) });
    if (!config) throw notFound('WiFi 構成が見つかりません');
    c.set('_targetTeamId', config.teamId);
    await next();
  },
  requireTeamEditor('teamId'),
  async (c) => {
    const id = c.req.param('id')!;
    await db.delete(wifiConfigs).where(eq(wifiConfigs.id, id));
    return c.json({ message: '削除しました' });
  },
);

export default app;
