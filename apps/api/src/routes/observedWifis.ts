import { zValidator } from '@hono/zod-validator';
import {
  BulkCreateObservedWifiSchema,
  CreateObservedWifiSchema,
  isValidChannel,
} from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { observedWifis } from '../db/schema/index.js';
import { validationError } from '../errors.js';
import { requireOperator } from '../middleware/auth.js';

const app = new Hono();

// GET /api/tournaments/:tournamentId/observed-wifis - 野良 WiFi 一覧 (public)
app.get('/tournaments/:tournamentId/observed-wifis', async (c) => {
  const { tournamentId } = c.req.param();
  const rows = await db
    .select()
    .from(observedWifis)
    .where(eq(observedWifis.tournamentId, tournamentId));
  return c.json(rows);
});

// POST /api/tournaments/:tournamentId/observed-wifis - 野良 WiFi 手動登録 (operator)
app.post(
  '/tournaments/:tournamentId/observed-wifis',
  requireOperator,
  zValidator('json', CreateObservedWifiSchema.omit({ tournamentId: true })),
  async (c) => {
    const { tournamentId } = c.req.param();
    const body = c.req.valid('json');

    if (!isValidChannel(body.band, body.channel)) {
      throw validationError(`帯域 ${body.band} に対してチャンネル ${body.channel} は無効です`);
    }

    const [row] = await db
      .insert(observedWifis)
      .values({
        ...body,
        tournamentId,
        observedAt: new Date(body.observedAt),
      })
      .returning();
    if (!row) throw new Error('insert failed');
    return c.json(row, 201);
  },
);

// POST /api/tournaments/:tournamentId/observed-wifis/bulk - CSV 一括登録 (operator)
app.post(
  '/tournaments/:tournamentId/observed-wifis/bulk',
  requireOperator,
  zValidator('json', BulkCreateObservedWifiSchema),
  async (c) => {
    const { tournamentId } = c.req.param();
    const { items } = c.req.valid('json');

    // バリデーション: チャンネル・帯域の整合性確認
    const errors: Array<{ row: number; message: string }> = [];
    for (const [i, item] of items.entries()) {
      if (!isValidChannel(item.band, item.channel)) {
        errors.push({
          row: i + 1,
          message: `帯域 ${item.band} に対してチャンネル ${item.channel} は無効です`,
        });
      }
    }

    if (errors.length > 0) {
      throw validationError('CSV に無効なデータが含まれています', { errors });
    }

    // トランザクション内で全件挿入
    const inserted = await db.transaction(async (tx) => {
      return tx
        .insert(observedWifis)
        .values(
          items.map((item) => ({
            ...item,
            tournamentId,
            observedAt: new Date(item.observedAt),
          })),
        )
        .returning();
    });

    return c.json({ count: inserted.length, items: inserted }, 201);
  },
);

export default app;
