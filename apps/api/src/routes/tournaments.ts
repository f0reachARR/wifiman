import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  type ChannelMapEntry,
  ChannelMapEntrySchema,
  CreateTournamentSchema,
  UpdateTournamentSchema,
} from "@wifiman/shared";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ContextVariableMap } from "hono";
import { db } from "../db/index.js";
import {
  deviceSpecs,
  issueReports,
  observedWifis,
  teams,
  tournaments,
  wifiConfigs,
} from "../db/schema/index.js";
import { notFound } from "../errors.js";
import { requireAnyViewer, requireOperator } from "../middleware/auth.js";

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const idParam = z.object({ id: z.string() });
const tournamentResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  venueName: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// GET /api/tournaments - 大会一覧 (public)
const listTournaments = createRoute({
  method: "get",
  path: "/tournaments",
  tags: ["tournaments"],
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(tournamentResponseSchema) },
      },
      description: "大会一覧",
    },
  },
});
app.openapi(listTournaments, async (c) => {
  const rows = await db
    .select()
    .from(tournaments)
    .orderBy(tournaments.startDate);
  return c.json(rows, 200);
});

// POST /api/tournaments - 大会作成 (operator)
const createTournament = createRoute({
  method: "post",
  path: "/tournaments",
  tags: ["tournaments"],
  middleware: [requireOperator] as const,
  request: {
    body: {
      content: { "application/json": { schema: CreateTournamentSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: tournamentResponseSchema } },
      description: "大会作成",
    },
    400: {
      content: { "application/json": { schema: errorSchema } },
      description: "バリデーションエラー",
    },
    401: {
      content: { "application/json": { schema: errorSchema } },
      description: "未認証",
    },
    403: {
      content: { "application/json": { schema: errorSchema } },
      description: "権限なし",
    },
  },
});
app.openapi(createTournament, async (c) => {
  const body = c.req.valid("json");
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
  if (!row) throw new Error("insert failed");
  return c.json(row, 201);
});

// GET /api/tournaments/:id - 大会詳細 (public)
const getTournament = createRoute({
  method: "get",
  path: "/tournaments/{id}",
  tags: ["tournaments"],
  request: { params: idParam },
  responses: {
    200: {
      content: { "application/json": { schema: tournamentResponseSchema } },
      description: "大会詳細",
    },
    404: {
      content: { "application/json": { schema: errorSchema } },
      description: "Not Found",
    },
  },
});
app.openapi(getTournament, async (c) => {
  const { id } = c.req.valid("param");
  const row = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, id),
  });
  if (!row) throw notFound("大会が見つかりません");
  return c.json(row, 200);
});

// PATCH /api/tournaments/:id - 大会更新 (operator)
const updateTournament = createRoute({
  method: "patch",
  path: "/tournaments/{id}",
  tags: ["tournaments"],
  middleware: [requireOperator] as const,
  request: {
    params: idParam,
    body: {
      content: { "application/json": { schema: UpdateTournamentSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: tournamentResponseSchema } },
      description: "大会更新",
    },
    400: {
      content: { "application/json": { schema: errorSchema } },
      description: "バリデーションエラー",
    },
    401: {
      content: { "application/json": { schema: errorSchema } },
      description: "未認証",
    },
    403: {
      content: { "application/json": { schema: errorSchema } },
      description: "権限なし",
    },
    404: {
      content: { "application/json": { schema: errorSchema } },
      description: "Not Found",
    },
  },
});
app.openapi(updateTournament, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const [row] = await db
    .update(tournaments)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(tournaments.id, id))
    .returning();
  if (!row) throw notFound("大会が見つかりません");
  return c.json(row, 200);
});

// GET /api/tournaments/:tournamentId/channel-map - チャンネルマップ (any_viewer)
const getChannelMap = createRoute({
  method: "get",
  path: "/tournaments/{tournamentId}/channel-map",
  tags: ["tournaments"],
  middleware: [requireAnyViewer] as const,
  request: { params: z.object({ tournamentId: z.string() }) },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(ChannelMapEntrySchema) },
      },
      description: "チャンネルマップ",
    },
    401: {
      content: { "application/json": { schema: errorSchema } },
      description: "未認証",
    },
    403: {
      content: { "application/json": { schema: errorSchema } },
      description: "権限なし",
    },
    404: {
      content: { "application/json": { schema: errorSchema } },
      description: "Not Found",
    },
  },
});
app.openapi(getChannelMap, async (c) => {
  const { tournamentId } = c.req.valid("param");

  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
  });
  if (!tournament) throw notFound("大会が見つかりません");

  // 閲覧者の teamId (own_team / participant_team 判定に使用)
  const authCtx = c.get("auth");
  const viewerTeamId = authCtx?.teamId;

  // デバイス仕様テーブルのエイリアス (AP / クライアント で別々に LEFT JOIN)
  const apDeviceSpec = alias(deviceSpecs, "ap_device_spec");
  const clientDeviceSpec = alias(deviceSpecs, "client_device_spec");

  // チームの WiFi 構成を JOIN で取得
  const teamConfigs = await db
    .select({
      wifiConfigId: wifiConfigs.id,
      wifiConfigName: wifiConfigs.name,
      teamId: wifiConfigs.teamId,
      teamName: teams.name,
      band: wifiConfigs.band,
      channel: wifiConfigs.channel,
      channelWidthMHz: wifiConfigs.channelWidthMHz,
      purpose: wifiConfigs.purpose,
      role: wifiConfigs.role,
      status: wifiConfigs.status,
      apDeviceModel: apDeviceSpec.model,
      clientDeviceModel: clientDeviceSpec.model,
    })
    .from(wifiConfigs)
    .innerJoin(teams, eq(wifiConfigs.teamId, teams.id))
    .leftJoin(apDeviceSpec, eq(wifiConfigs.apDeviceId, apDeviceSpec.id))
    .leftJoin(
      clientDeviceSpec,
      eq(wifiConfigs.clientDeviceId, clientDeviceSpec.id),
    )
    .where(
      and(
        eq(teams.tournamentId, tournamentId),
        ne(wifiConfigs.status, "disabled"),
      ),
    );

  // wifiConfigId ごとの不具合報告件数を集計する。
  // 他チームの private 報告数は aggregate でも漏らさない。
  const reportRows = await db
    .select({
      wifiConfigId: issueReports.wifiConfigId,
      teamId: issueReports.teamId,
      visibility: issueReports.visibility,
    })
    .from(issueReports)
    .where(
      and(
        eq(issueReports.tournamentId, tournamentId),
        isNotNull(issueReports.wifiConfigId),
      ),
    );
  const reportCountMap = new Map<string, number>();
  for (const row of reportRows) {
    if (!row.wifiConfigId) continue;
    const canCount =
      authCtx?.userRole === "operator" ||
      (viewerTeamId != null && row.teamId === viewerTeamId) ||
      row.visibility === "team_public";
    if (!canCount) continue;
    reportCountMap.set(
      row.wifiConfigId,
      (reportCountMap.get(row.wifiConfigId) ?? 0) + 1,
    );
  }

  // 野良 WiFi を取得
  const wildWifis = await db
    .select()
    .from(observedWifis)
    .where(eq(observedWifis.tournamentId, tournamentId));

  const entries: ChannelMapEntry[] = [
    ...teamConfigs.map((cfg): ChannelMapEntry => {
      const sourceType: "own_team" | "participant_team" =
        viewerTeamId != null && viewerTeamId === cfg.teamId
          ? "own_team"
          : "participant_team";
      return {
        sourceType,
        band: cfg.band,
        channel: cfg.channel,
        channelWidthMHz: cfg.channelWidthMHz,
        wifiConfigId: cfg.wifiConfigId,
        wifiConfigName: cfg.wifiConfigName,
        teamId: cfg.teamId,
        teamName: cfg.teamName,
        purpose: cfg.purpose,
        role: cfg.role,
        status: cfg.status,
        apDeviceModel: cfg.apDeviceModel ?? null,
        clientDeviceModel: cfg.clientDeviceModel ?? null,
        reportCount: reportCountMap.get(cfg.wifiConfigId) ?? 0,
      };
    }),
    ...wildWifis.map(
      (w): Extract<ChannelMapEntry, { sourceType: "observed_wifi" }> => ({
        sourceType: "observed_wifi",
        band: w.band,
        channel: w.channel,
        channelWidthMHz: w.channelWidthMHz ?? undefined,
        observedWifiId: w.id,
        ssid: w.ssid,
        source: w.source,
        rssi: w.rssi ?? null,
        locationLabel: w.locationLabel ?? null,
        observedAt: w.observedAt.toISOString(),
      }),
    ),
  ];

  // 帯域 → チャンネル順でソート
  const bandOrder: Record<string, number> = {
    "2.4GHz": 0,
    "5GHz": 1,
    "6GHz": 2,
  };
  entries.sort((a, b) => {
    const bo = (bandOrder[a.band] ?? 99) - (bandOrder[b.band] ?? 99);
    return bo !== 0 ? bo : a.channel - b.channel;
  });

  return c.json(entries, 200);
});

export default app;
