import { createRoute, z } from '@hono/zod-openapi';
import {
  CreateIssueReportBaseSchema,
  CreateIssueReportSchema,
  IssueReportSchema,
  isValidChannel,
  isValidChannelWidth,
  PublicIssueReportSummarySchema,
  UpdateIssueReportSchema,
} from '@wifiman/shared';
import { eq } from 'drizzle-orm';
import { resolveIssueReportCreateScope } from '../authz.js';
import { db } from '../db/index.js';
import { deviceSpecs, issueReports, teams, wifiConfigs } from '../db/schema/index.js';
import { forbidden, notFound, unauthorized, unprocessable } from '../errors.js';
import { requireAnyViewer, requireParticipant } from '../middleware/auth.js';
import { createOpenApiApp, errorSchema } from '../openapi.js';

const app = createOpenApiApp();
const issueReportResponseSchema = IssueReportSchema;
const publicIssueReportSummarySchema = PublicIssueReportSummarySchema;
const issueReportListResponseSchema = z.array(
  z.union([issueReportResponseSchema, publicIssueReportSummarySchema]),
);
const deleteResponseSchema = z.object({ message: z.string() });
const issueReportSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  bySeverity: z.record(z.string(), z.number().int().nonnegative()),
  byBand: z.record(z.string(), z.number().int().nonnegative()),
  byChannel: z.array(
    z.object({
      band: z.string(),
      channel: z.number().int().positive(),
      count: z.number().int().nonnegative(),
    }),
  ),
  topSymptoms: z.array(
    z.object({
      symptom: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});

function canViewIssueReportDetail(
  authCtx: { userRole?: 'user' | 'operator'; teamId?: string } | undefined,
  row: { teamId: string | null },
): boolean {
  if (authCtx?.userRole === 'operator') return true;
  return Boolean(authCtx?.teamId && authCtx.teamId === row.teamId);
}

function canViewIssueReportSummary(
  authCtx:
    | {
        userRole?: 'user' | 'operator';
        teamId?: string;
        teamTournamentId?: string;
      }
    | undefined,
  row: {
    teamId: string | null;
    tournamentId: string;
    visibility: 'team_private' | 'team_public';
  },
): boolean {
  if (canViewIssueReportDetail(authCtx, row)) return true;
  return Boolean(
    authCtx?.teamId &&
      authCtx.teamTournamentId === row.tournamentId &&
      row.visibility === 'team_public',
  );
}

function canAccessIssueReportTournament(
  authCtx:
    | {
        userRole?: 'user' | 'operator';
        teamId?: string;
        teamTournamentId?: string;
      }
    | undefined,
  row: { tournamentId: string },
): boolean {
  if (authCtx?.userRole === 'operator') return true;
  if (!authCtx?.teamId) return false;
  return authCtx.teamTournamentId === row.tournamentId;
}

function toPublicIssueReportSummary(row: Record<string, unknown>) {
  const {
    reporterName: _reporterName,
    locationLabel: _locationLabel,
    description: _description,
    attachments: _attachments,
    ...summary
  } = row;
  return summary;
}

function validateIssueReportChannel(
  band: '2.4GHz' | '5GHz' | '6GHz',
  channel: number,
  channelWidthMHz: number | null | undefined,
) {
  if (!isValidChannel(band, channel)) {
    throw unprocessable(`帯域 ${band} に対してチャンネル ${channel} は無効です`);
  }
  if (channelWidthMHz !== null && channelWidthMHz !== undefined) {
    if (!isValidChannelWidth(band, channelWidthMHz as 20 | 40 | 80 | 160)) {
      throw unprocessable(`帯域 ${band} に対してチャンネル幅 ${channelWidthMHz}MHz は無効です`);
    }
  }
}

async function assertTeamInTournament(teamId: string, tournamentId: string) {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team || team.tournamentId !== tournamentId) {
    throw unprocessable('対象チームが大会スコープ外です');
  }
  return team;
}

async function assertWifiConfigInTournament(
  wifiConfigId: string,
  tournamentId: string,
  scopedTeamId: string | null | undefined,
) {
  const config = await db.query.wifiConfigs.findFirst({
    where: eq(wifiConfigs.id, wifiConfigId),
  });
  if (!config) {
    throw unprocessable('指定された WiFi 構成が見つかりません');
  }

  if (scopedTeamId && config.teamId !== scopedTeamId) {
    throw forbidden('他チームの WiFi 構成は指定できません');
  }

  const configTeam = await db.query.teams.findFirst({
    where: eq(teams.id, config.teamId),
  });
  if (!configTeam || configTeam.tournamentId !== tournamentId) {
    throw unprocessable('対象 WiFi 構成が大会スコープ外です');
  }

  return config;
}

// GET /api/tournaments/:tournamentId/issue-reports - 報告一覧 (any_viewer, 自チームのみ)
const listIssueReports = createRoute({
  method: 'get',
  path: '/tournaments/{tournamentId}/issue-reports',
  tags: ['issue-reports'],
  middleware: [requireAnyViewer] as const,
  request: { params: z.object({ tournamentId: z.string() }) },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(z.union([issueReportResponseSchema, publicIssueReportSummarySchema])),
        },
      },
      description: '報告一覧',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: '権限なし',
    },
  },
});
app.openapi(listIssueReports, async (c) => {
  const { tournamentId } = c.req.valid('param');
  const authCtx = c.get('auth');
  const rows = await db
    .select()
    .from(issueReports)
    .where(eq(issueReports.tournamentId, tournamentId));

  const visibleRows = rows.filter((r) => canViewIssueReportSummary(authCtx, r));
  return c.json(
    issueReportListResponseSchema.parse(
      visibleRows.map((row) =>
        canViewIssueReportDetail(authCtx, row) ? row : toPublicIssueReportSummary(row),
      ),
    ),
    200,
  );
});

// GET /api/tournaments/:tournamentId/issue-reports/summary - 報告サマリ (any_viewer, 自チームのみ)
const summaryIssueReports = createRoute({
  method: 'get',
  path: '/tournaments/{tournamentId}/issue-reports/summary',
  tags: ['issue-reports'],
  middleware: [requireAnyViewer] as const,
  request: { params: z.object({ tournamentId: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: issueReportSummarySchema } },
      description: '報告サマリ',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: '権限なし',
    },
  },
});
app.openapi(summaryIssueReports, async (c) => {
  const { tournamentId } = c.req.valid('param');
  const authCtx = c.get('auth');
  const rows = await db
    .select()
    .from(issueReports)
    .where(eq(issueReports.tournamentId, tournamentId));

  const visibleRows = rows.filter((r) => canViewIssueReportSummary(authCtx, r));

  const total = visibleRows.length;
  const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 } as Record<string, number>;
  const byBand = { '2.4GHz': 0, '5GHz': 0, '6GHz': 0 } as Record<string, number>;
  const channelCounts = new Map<string, { band: string; channel: number; count: number }>();
  const symptomCounts = new Map<string, number>();

  for (const r of visibleRows) {
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
  middleware: [requireParticipant] as const,
  request: {
    params: z.object({ tournamentId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: CreateIssueReportBaseSchema.omit({ tournamentId: true }),
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: issueReportResponseSchema } },
      description: '報告作成',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: '権限なし',
    },
    422: {
      content: { 'application/json': { schema: errorSchema } },
      description: '処理不能',
    },
  },
});
app.openapi(createIssueReport, async (c) => {
  const { tournamentId } = c.req.valid('param');
  const rawBody = c.req.valid('json');
  const parsedBody = CreateIssueReportSchema.safeParse({
    ...rawBody,
    tournamentId,
  });
  if (!parsedBody.success) {
    throw unprocessable('不具合報告の入力内容が不正です', {
      issues: parsedBody.error.issues,
    });
  }
  const body = parsedBody.data;
  const authCtx = c.get('auth');

  const scope = resolveIssueReportCreateScope(authCtx, body.teamId);
  if (scope.kind === 'unauthorized') {
    throw unauthorized();
  }
  if (scope.kind === 'forbidden') {
    throw forbidden('チーム参加者または運営者権限が必要です');
  }

  let finalBody = { ...body, teamId: scope.scopedTeamId };

  if (scope.scopedTeamId) {
    await assertTeamInTournament(scope.scopedTeamId, tournamentId);
  }

  // wifiConfigId 指定時の自動補完
  if (body.wifiConfigId) {
    const config = await assertWifiConfigInTournament(
      body.wifiConfigId,
      tournamentId,
      scope.scopedTeamId,
    );

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

  if (finalBody.band === undefined || finalBody.channel === undefined) {
    throw unprocessable('帯域とチャンネルを補完できませんでした');
  }
  validateIssueReportChannel(finalBody.band, finalBody.channel, finalBody.channelWidthMHz);

  const [row] = await db
    .insert(issueReports)
    .values({
      ...finalBody,
      band: finalBody.band,
      channel: finalBody.channel,
      tournamentId,
    })
    .returning();
  if (!row) throw new Error('insert failed');
  return c.json(issueReportResponseSchema.parse(row), 201);
});

// GET /api/issue-reports/:id - 報告詳細 (any_viewer, 自チームのみ)
const getIssueReport = createRoute({
  method: 'get',
  path: '/issue-reports/{id}',
  tags: ['issue-reports'],
  middleware: [requireAnyViewer] as const,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.union([issueReportResponseSchema, publicIssueReportSummarySchema]),
        },
      },
      description: '報告詳細',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: '権限なし',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Not Found',
    },
  },
});
app.openapi(getIssueReport, async (c) => {
  const { id } = c.req.valid('param');
  const authCtx = c.get('auth');
  const row = await db.query.issueReports.findFirst({
    where: eq(issueReports.id, id),
  });
  if (!row) throw notFound('報告が見つかりません');

  if (!canAccessIssueReportTournament(authCtx, row)) {
    throw forbidden('対象大会へのアクセス権限がありません');
  }

  if (!canViewIssueReportSummary(authCtx, row)) {
    throw forbidden('アクセス権限がありません');
  }

  return c.json(
    z
      .union([issueReportResponseSchema, publicIssueReportSummarySchema])
      .parse(canViewIssueReportDetail(authCtx, row) ? row : toPublicIssueReportSummary(row)),
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
    body: {
      content: { 'application/json': { schema: UpdateIssueReportSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: issueReportResponseSchema } },
      description: '報告更新',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'バリデーションエラー',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: '権限なし',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Not Found',
    },
  },
});
app.openapi(updateIssueReport, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const authCtx = c.get('auth');

  const existing = await db.query.issueReports.findFirst({
    where: eq(issueReports.id, id),
  });
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

  if (body.teamId !== undefined && body.teamId !== existing.teamId) {
    throw forbidden('報告更新で teamId は変更できません');
  }
  if (body.wifiConfigId !== undefined && body.wifiConfigId !== existing.wifiConfigId) {
    throw forbidden('報告更新で wifiConfigId は変更できません');
  }

  if (existing.teamId) {
    await assertTeamInTournament(existing.teamId, existing.tournamentId);
  }

  if (existing.wifiConfigId) {
    const config = await db.query.wifiConfigs.findFirst({
      where: eq(wifiConfigs.id, existing.wifiConfigId),
    });
    if (!config) {
      throw unprocessable('報告の WiFi 構成参照が不正です');
    }
    if (existing.teamId && config.teamId !== existing.teamId) {
      throw unprocessable('報告の team と WiFi 構成の整合性が不正です');
    }
    const configTeam = await db.query.teams.findFirst({
      where: eq(teams.id, config.teamId),
    });
    if (!configTeam || configTeam.tournamentId !== existing.tournamentId) {
      throw unprocessable('報告の tournament と WiFi 構成の整合性が不正です');
    }
  }

  const nextBand = body.band ?? existing.band;
  const nextChannel = body.channel ?? existing.channel;
  const nextWidth = body.channelWidthMHz ?? existing.channelWidthMHz;
  if (body.band !== undefined || body.channel !== undefined || body.channelWidthMHz !== undefined) {
    validateIssueReportChannel(nextBand, nextChannel, nextWidth);
  }

  const [row] = await db
    .update(issueReports)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(issueReports.id, id))
    .returning();
  if (!row) throw notFound('報告が見つかりません');
  return c.json(issueReportResponseSchema.parse(row), 200);
});

// DELETE /api/issue-reports/:id - 報告削除 (team_editor or operator)
const deleteIssueReport = createRoute({
  method: 'delete',
  path: '/issue-reports/{id}',
  tags: ['issue-reports'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: deleteResponseSchema } },
      description: '削除成功',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: '未認証',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: '権限なし',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Not Found',
    },
  },
});
app.openapi(deleteIssueReport, async (c) => {
  const { id } = c.req.valid('param');
  const authCtx = c.get('auth');

  const existing = await db.query.issueReports.findFirst({
    where: eq(issueReports.id, id),
  });
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
