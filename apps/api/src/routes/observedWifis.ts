import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  BulkCreateObservedWifiSchema,
  CreateObservedWifiSchema,
  isValidChannel,
  isValidChannelWidth,
} from "@wifiman/shared";
import { eq } from "drizzle-orm";
import type { ContextVariableMap } from "hono";
import { db } from "../db/index.js";
import { observedWifis, tournaments } from "../db/schema/index.js";
import { notFound, validationError } from "../errors.js";
import { requireOperator } from "../middleware/auth.js";

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const observedWifiResponseSchema = z.object({
  id: z.string(),
  tournamentId: z.string(),
  source: z.enum(["wild", "analyzer_import", "manual"]),
  ssid: z.string().nullable(),
  bssid: z.string().nullable(),
  band: z.enum(["2.4GHz", "5GHz", "6GHz"]),
  channel: z.number().int(),
  channelWidthMHz: z.number().int().nullable(),
  rssi: z.number().nullable(),
  locationLabel: z.string().nullable(),
  observedAt: z.date(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
const publicObservedWifiResponseSchema = observedWifiResponseSchema.omit({
  notes: true,
});
const bulkCreateObservedWifiResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(observedWifiResponseSchema),
});

async function assertTournamentExists(tournamentId: string) {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
  });
  if (!tournament) throw notFound("大会が見つかりません");
}

function validateObservedWifiChannel(
  item: {
    band: "2.4GHz" | "5GHz" | "6GHz";
    channel: number;
    channelWidthMHz?: number | undefined;
  },
  row?: number,
): string | undefined {
  const prefix = row === undefined ? "" : `${row} 行目: `;
  if (!isValidChannel(item.band, item.channel)) {
    return `${prefix}帯域 ${item.band} に対してチャンネル ${item.channel} は無効です`;
  }
  if (
    item.channelWidthMHz !== undefined &&
    !isValidChannelWidth(item.band, item.channelWidthMHz as 20 | 40 | 80 | 160)
  ) {
    return `${prefix}帯域 ${item.band} に対してチャンネル幅 ${item.channelWidthMHz}MHz は無効です`;
  }
  return undefined;
}

// GET /api/tournaments/:tournamentId/observed-wifis - 野良 WiFi 一覧 (public)
const listObservedWifis = createRoute({
  method: "get",
  path: "/tournaments/{tournamentId}/observed-wifis",
  tags: ["observed-wifis"],
  request: { params: z.object({ tournamentId: z.string() }) },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(publicObservedWifiResponseSchema),
        },
      },
      description: "野良 WiFi 一覧",
    },
  },
});
app.openapi(listObservedWifis, async (c) => {
  const { tournamentId } = c.req.valid("param");
  const rows = await db
    .select()
    .from(observedWifis)
    .where(eq(observedWifis.tournamentId, tournamentId));
  return c.json(
    rows.map(({ notes: _notes, ...publicRow }) => publicRow),
    200,
  );
});

// POST /api/tournaments/:tournamentId/observed-wifis - 野良 WiFi 手動登録 (operator)
const createObservedWifi = createRoute({
  method: "post",
  path: "/tournaments/{tournamentId}/observed-wifis",
  tags: ["observed-wifis"],
  middleware: [requireOperator] as const,
  request: {
    params: z.object({ tournamentId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: CreateObservedWifiSchema.omit({ tournamentId: true }),
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: observedWifiResponseSchema } },
      description: "野良 WiFi 登録",
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
app.openapi(createObservedWifi, async (c) => {
  const { tournamentId } = c.req.valid("param");
  const body = c.req.valid("json");

  await assertTournamentExists(tournamentId);

  const channelError = validateObservedWifiChannel(body);
  if (channelError) {
    throw validationError(channelError);
  }

  const [row] = await db
    .insert(observedWifis)
    .values({
      ...body,
      tournamentId,
      observedAt: new Date(body.observedAt),
    })
    .returning();
  if (!row) throw new Error("insert failed");
  return c.json(row, 201);
});

// POST /api/tournaments/:tournamentId/observed-wifis/bulk - CSV 一括登録 (operator)
const bulkCreateObservedWifis = createRoute({
  method: "post",
  path: "/tournaments/{tournamentId}/observed-wifis/bulk",
  tags: ["observed-wifis"],
  middleware: [requireOperator] as const,
  request: {
    params: z.object({ tournamentId: z.string() }),
    body: {
      content: { "application/json": { schema: BulkCreateObservedWifiSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: bulkCreateObservedWifiResponseSchema },
      },
      description: "一括登録",
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
app.openapi(bulkCreateObservedWifis, async (c) => {
  const { tournamentId } = c.req.valid("param");
  const { items } = c.req.valid("json");

  await assertTournamentExists(tournamentId);

  // バリデーション: チャンネル・帯域の整合性確認
  const errors: Array<{ row: number; message: string }> = [];
  for (const [i, item] of items.entries()) {
    const channelError = validateObservedWifiChannel(item, i + 1);
    if (channelError) {
      errors.push({ row: i + 1, message: channelError });
    }
  }

  if (errors.length > 0) {
    throw validationError("CSV に無効なデータが含まれています", { errors });
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
});

export default app;
