import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { CreateIssueReportSchema, UpdateIssueReportSchema } from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import type { ContextVariableMap } from 'hono';
import { db } from '../db/index.js';
import { deviceSpecs, issueReports, wifiConfigs } from '../db/schema/index.js';
import { forbidden, notFound, unauthorized } from '../errors.js';

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

// GET /api/tournaments/:tournamentId/issue-reports - 報告一覧 (team_viewer)
const listIssueReports = createRoute({
  method: 'get',
  path: '/tournaments/{tournamentId}/issue-reports',
  tags: ['issue-reports'],
  request: { params: z.object({ tournamentId: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.array(z.any()) } }, description: '報告一覧' },
  },
});
app.openapi(listIssueReports, async (c) => {
  const { tournamentId } = c.req.valid('param');
  const authCtx = c.get('auth');
  const rows = await db
    .select()
    .from(issueReports)
    .where(eq(issueReports.tournamentId, tournamentId));

  // チームトークン保持者は自チームの報告のみ
  if (authCtx?.teamId && authCtx.userRole !== 'operator') {
    return c.json(
      rows.filter((r) => r.teamId === authCtx.teamId),
      200,
    );
  }
  return c.json(rows, 200);
});

// POST /api/tournaments/:tournamentId/issue-reports - 報告作成 (team_editor)
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
      mitigationTried: finalBody.mitigationTried ? JSON.stringify(finalBody.mitigationTried) : null,
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
});

// GET /api/issue-reports/:id - 報告詳細 (team_viewer)
const getIssueReport = createRoute({
  method: 'get',
  path: '/issue-reports/{id}',
  tags: ['issue-reports'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: '報告詳細' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: '権限なし' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not Found' },
  },
});
app.openapi(getIssueReport, async (c) => {
  const { id } = c.req.valid('param');
  const authCtx = c.get('auth');
  const row = await db.query.issueReports.findFirst({ where: eq(issueReports.id, id) });
  if (!row) throw notFound('報告が見つかりません');

  // チームトークン保持者は自チームの報告のみ
  if (authCtx?.teamId && authCtx.userRole !== 'operator') {
    if (row.teamId !== authCtx.teamId) {
      throw forbidden('アクセス権限がありません');
    }
  }

  return c.json(
    {
      ...row,
      mitigationTried: row.mitigationTried ? JSON.parse(row.mitigationTried) : null,
    },
    200,
  );
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

  return c.json(
    {
      ...row,
      mitigationTried: row.mitigationTried ? JSON.parse(row.mitigationTried) : null,
    },
    200,
  );
});

export default app;
