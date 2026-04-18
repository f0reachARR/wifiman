import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { CreateIssueReportSchema, UpdateIssueReportSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import type { ContextVariableMap } from 'hono';
import { db } from '../db/index.js';
import { deviceSpecs, issueReports, wifiConfigs } from '../db/schema/index.js';
import { forbidden, notFound, unauthorized } from '../errors.js';
import { requireAnyViewer } from '../middleware/auth.js';

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

// GET /api/tournaments/:tournamentId/issue-reports - 報告一覧 (any_viewer, 自チームのみ)
const listIssueReports = createRoute({
  method: 'get',
  path: '/tournaments/{tournamentId}/issue-reports',
  tags: ['issue-reports'],
  middleware: [requireAnyViewer] as const,
  request: { params: z.object({ tournamentId: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.array(z.any()) } }, description: '報告一覧' },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
  },
});
app.openapi(listIssueReports, async (c) => {
  const { tournamentId } = c.req.valid('param');
  const authCtx = c.get('auth');
  const rows = await db
    .select()
    .from(issueReports)
    .where(eq(issueReports.tournamentId, tournamentId));

  if (authCtx?.userRole === 'operator') {
    return c.json(rows, 200);
  }
  // チームトークン保持者は自チームの報告のみ
  if (authCtx?.teamId) {
    return c.json(
      rows.filter((r) => r.teamId === authCtx.teamId),
      200,
    );
  }
  // ログイン済だが teamId 未設定 → 自チームが特定できないため空を返す
  return c.json([], 200);
});

// GET /api/tournaments/:tournamentId/issue-reports/summary - 報告サマリ (any_viewer, 自チームのみ)
const summaryIssueReports = createRoute({
  method: 'get',
  path: '/tournaments/{tournamentId}/issue-reports/summary',
  tags: ['issue-reports'],
  middleware: [requireAnyViewer] as const,
  request: { params: z.object({ tournamentId: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: '報告サマリ' },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
  },
});
app.openapi(summaryIssueReports, async (c) => {
  const { tournamentId } = c.req.valid('param');
  const authCtx = c.get('auth');
  let rows = await db
    .select()
    .from(issueReports)
    .where(eq(issueReports.tournamentId, tournamentId));

  if (authCtx?.userRole !== 'operator') {
    if (authCtx?.teamId) {
      // チームトークン保持者は自チームの報告のみ
      rows = rows.filter((r) => r.teamId === authCtx.teamId);
    } else {
      // ログイン済だが teamId 未設定 → 空サマリを返す
      rows = [];
    }
  }

  const total = rows.length;
  const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 } as Record<string, number>;
  const byBand = { '2.4GHz': 0, '5GHz': 0, '6GHz': 0 } as Record<string, number>;
  const channelCounts = new Map<string, { band: string; channel: number; count: number }>();
  const symptomCounts = new Map<string, number>();

  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
    byBand[r.band] = (byBand[r.band] ?? 0) + 1;
    const key = `${r.band}:${r.channel}`;
    const existing = channelCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      channelCounts.set(key, { band: r.band, channel: r.channel, count: 1 });
    }
    symptomCounts.set(r.symptom, (symptomCounts.get(r.symptom) ?? 0) + 1);
  }

  const byChannel = Array.from(channelCounts.values()).sort((a, b) =>
    a.band !== b.band ? a.band.localeCompare(b.band) : a.channel - b.channel,
  );
  const topSymptoms = Array.from(symptomCounts.entries())
    .map(([symptom, count]) => ({ symptom, count }))
    .sort((a, b) => b.count - a.count);

  return c.json({ total, bySeverity, byBand, byChannel, topSymptoms }, 200);
});

// POST /api/tournaments/:tournamentId/issue-reports - 報告作成
const createIssueReport = createRoute({
  method: 'post',
  path: '/tournaments/{tournamentId}/issue-reports',
  tags: ['issue-reports'],
  request: {
    params: z.object({ tournamentId: z.string() }),
    body: {
      content: {
        'application/json': { schema: CreateIssueReportSchema.omit({ tournamentId: true }) },
      },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: z.any() } }, description: '報告作成' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
  },
});
app.openapi(createIssueReport, async (c) => {
  const { tournamentId } = c.req.valid('param');
  const body = c.req.valid('json');
  const authCtx = c.get('auth');

  // チームトークンが必要 (またはoperator)
  if (!authCtx?.userId && !authCtx?.teamId) {
    throw unauthorized('認証が必要です');
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
      syncStatus: 'synced',
    })
    .returning();
  if (!row) throw new Error('insert failed');
  return c.json(row, 201);
});

// GET /api/issue-reports/:id - 報告詳細 (any_viewer, 自チームのみ)
const getIssueReport = createRoute({
  method: 'get',
  path: '/issue-reports/{id}',
  tags: ['issue-reports'],
  middleware: [requireAnyViewer] as const,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: '報告詳細' },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(getIssueReport, async (c) => {
  const { id } = c.req.valid('param');
  const authCtx = c.get('auth');
  const row = await db.query.issueReports.findFirst({ where: eq(issueReports.id, id) });
  if (!row) throw notFound('報告が見つかりません');

  // operator はすべて閲覧可能。それ以外は自チームの報告のみ
  if (authCtx?.userRole !== 'operator') {
    if (!authCtx?.teamId || authCtx.teamId !== row.teamId) {
      throw forbidden('アクセス権限がありません');
    }
  }

  return c.json(row, 200);
});

// PATCH /api/issue-reports/:id - 報告追記 (team_editor)
const updateIssueReport = createRoute({
  method: 'patch',
  path: '/issue-reports/{id}',
  tags: ['issue-reports'],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: UpdateIssueReportSchema } }, required: true },
  },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: '報告更新' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(updateIssueReport, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const authCtx = c.get('auth');

  const existing = await db.query.issueReports.findFirst({ where: eq(issueReports.id, id) });
  if (!existing) throw notFound('報告が見つかりません');

  // 権限チェック: operator または当該チームの editor
  if (authCtx?.userRole !== 'operator') {
    if (!authCtx?.userId && !authCtx?.teamId) {
      throw unauthorized();
    }
    if (
      !authCtx?.teamId ||
      authCtx.teamId !== existing.teamId ||
      authCtx.teamAccessRole !== 'editor'
    ) {
      throw forbidden('報告の編集権限がありません');
    }
  }

  const [row] = await db
    .update(issueReports)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(issueReports.id, id))
    .returning();
  if (!row) throw notFound('報告が見つかりません');
  return c.json(row, 200);
});

// DELETE /api/issue-reports/:id - 報告削除 (team_editor or operator)
const deleteIssueReport = createRoute({
  method: 'delete',
  path: '/issue-reports/{id}',
  tags: ['issue-reports'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: '削除成功' },
    401: { content: { 'application/json': { schema: errorSchema } }, description: '未認証' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(deleteIssueReport, async (c) => {
  const { id } = c.req.valid('param');
  const authCtx = c.get('auth');

  const existing = await db.query.issueReports.findFirst({ where: eq(issueReports.id, id) });
  if (!existing) throw notFound('報告が見つかりません');

  // 権限チェック: operator または当該チームの editor
  if (authCtx?.userRole !== 'operator') {
    if (!authCtx?.userId && !authCtx?.teamId) {
      throw unauthorized();
    }
    if (
      !authCtx?.teamId ||
      authCtx.teamId !== existing.teamId ||
      authCtx.teamAccessRole !== 'editor'
    ) {
      throw forbidden('報告の削除権限がありません');
    }
  }

  await db.delete(issueReports).where(eq(issueReports.id, id));
  return c.json({ message: '削除しました' }, 200);
});

export default app;
