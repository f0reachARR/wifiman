import { zValidator } from '@hono/zod-validator';
import { CreateIssueReportSchema, UpdateIssueReportSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { deviceSpecs, issueReports, wifiConfigs } from '../db/schema/index.js';
import { notFound } from '../errors.js';
import { setAuthContext } from '../middleware/auth.js';

const app = new Hono();

// GET /api/tournaments/:tournamentId/issue-reports - 報告一覧 (team_viewer)
app.get('/tournaments/:tournamentId/issue-reports', setAuthContext, async (c) => {
  const tournamentId = c.req.param('tournamentId')!;
  const authCtx = c.get('auth');
  const rows = await db
    .select()
    .from(issueReports)
    .where(eq(issueReports.tournamentId, tournamentId));

  // チームトークン保持者は自チームの報告のみ
  if (authCtx?.teamId && authCtx.userRole !== 'operator') {
    return c.json(rows.filter((r) => r.teamId === authCtx.teamId));
  }
  return c.json(rows);
});

// POST /api/tournaments/:tournamentId/issue-reports - 報告作成 (team_editor)
app.post(
  '/tournaments/:tournamentId/issue-reports',
  setAuthContext,
  zValidator('json', CreateIssueReportSchema.omit({ tournamentId: true })),
  async (c) => {
    const tournamentId = c.req.param('tournamentId')!;
    const body = c.req.valid('json');
    const authCtx = c.get('auth');

    // チームトークンが必要 (またはoperator)
    if (!authCtx?.userId && !authCtx?.teamId) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }, 401);
    }

    let finalBody = { ...body };

    // wifiConfigId 指定時の自動補完
    if (body.wifiConfigId) {
      const config = await db.query.wifiConfigs.findFirst({
        where: eq(wifiConfigs.id, body.wifiConfigId),
      });
      if (config) {
        finalBody = {
          ...finalBody,
          band: finalBody.band ?? config.band,
          channel: finalBody.channel ?? config.channel,
          channelWidthMHz: finalBody.channelWidthMHz ?? config.channelWidthMHz ?? undefined,
        };

        // AP 機材モデルの自動補完
        if (!finalBody.apDeviceModel && config.apDeviceId) {
          const apDevice = await db.query.deviceSpecs.findFirst({
            where: eq(deviceSpecs.id, config.apDeviceId),
          });
          if (apDevice) finalBody.apDeviceModel = apDevice.model;
        }

        // クライアント機材モデルの自動補完
        if (!finalBody.clientDeviceModel && config.clientDeviceId) {
          const clientDevice = await db.query.deviceSpecs.findFirst({
            where: eq(deviceSpecs.id, config.clientDeviceId),
          });
          if (clientDevice) finalBody.clientDeviceModel = clientDevice.model;
        }
      }
    }

    const [row] = await db
      .insert(issueReports)
      .values({
        ...finalBody,
        tournamentId,
        mitigationTried: finalBody.mitigationTried
          ? JSON.stringify(finalBody.mitigationTried)
          : null,
        syncStatus: 'synced',
      })
      .returning();
    if (!row) throw new Error('insert failed');

    return c.json(
      {
        ...row,
        mitigationTried: row.mitigationTried ? JSON.parse(row.mitigationTried) : null,
      },
      201,
    );
  },
);

// GET /api/issue-reports/:id - 報告詳細 (team_viewer)
app.get('/issue-reports/:id', setAuthContext, async (c) => {
  const id = c.req.param('id')!;
  const authCtx = c.get('auth');
  const row = await db.query.issueReports.findFirst({ where: eq(issueReports.id, id) });
  if (!row) throw notFound('報告が見つかりません');

  // チームトークン保持者は自チームの報告のみ
  if (authCtx?.teamId && authCtx.userRole !== 'operator') {
    if (row.teamId !== authCtx.teamId) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'アクセス権限がありません' } }, 403);
    }
  }

  return c.json({
    ...row,
    mitigationTried: row.mitigationTried ? JSON.parse(row.mitigationTried) : null,
  });
});

// PATCH /api/issue-reports/:id - 報告追記 (team_editor)
app.patch(
  '/issue-reports/:id',
  setAuthContext,
  zValidator('json', UpdateIssueReportSchema),
  async (c) => {
    const id = c.req.param('id')!;
    const body = c.req.valid('json');
    const authCtx = c.get('auth');

    const existing = await db.query.issueReports.findFirst({ where: eq(issueReports.id, id) });
    if (!existing) throw notFound('報告が見つかりません');

    // 権限チェック: operator または当該チームの editor
    if (authCtx?.userRole !== 'operator') {
      if (
        !authCtx?.teamId ||
        authCtx.teamId !== existing.teamId ||
        authCtx.teamAccessRole !== 'editor'
      ) {
        return c.json({ error: { code: 'FORBIDDEN', message: '報告の編集権限がありません' } }, 403);
      }
    }

    const updateData = {
      ...(() => {
        const { mitigationTried: _m, ...rest } = body;
        return rest;
      })(),
      updatedAt: new Date(),
      ...(body.mitigationTried !== undefined && {
        mitigationTried: JSON.stringify(body.mitigationTried),
      }),
    };

    const [row] = await db
      .update(issueReports)
      .set(updateData)
      .where(eq(issueReports.id, id))
      .returning();
    if (!row) throw notFound('報告が見つかりません');

    return c.json({
      ...row,
      mitigationTried: row.mitigationTried ? JSON.parse(row.mitigationTried) : null,
    });
  },
);

export default app;
