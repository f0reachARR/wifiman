import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  CreateDeviceSpecSchema,
  UpdateDeviceSpecSchema,
} from "@wifiman/shared";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { ContextVariableMap, MiddlewareHandler } from "hono";
import { db } from "../db/index.js";
import { deviceSpecs, teams } from "../db/schema/index.js";
import { notFound } from "../errors.js";
import { requireTeamEditor, requireTeamViewer } from "../middleware/auth.js";

const app = new OpenAPIHono<{ Variables: ContextVariableMap }>();

const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const deviceSpecResponseSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  vendor: z.string().nullable(),
  model: z.string(),
  kind: z.enum(["ap", "client", "usb_dongle", "router", "bridge", "other"]),
  supportedBands: z.array(z.string()),
  notes: z.string().nullable(),
  knownIssues: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  archivedAt: z.date().nullable(),
});
const publicDeviceSpecResponseSchema = deviceSpecResponseSchema.omit({
  notes: true,
  archivedAt: true,
});
const archiveResponseSchema = z.object({ message: z.string(), id: z.string() });
type AppMiddleware = MiddlewareHandler<{ Variables: ContextVariableMap }>;

function toPublicDeviceSpec(
  row: z.infer<typeof deviceSpecResponseSchema>,
): z.infer<typeof publicDeviceSpecResponseSchema> {
  const { notes: _notes, archivedAt: _archivedAt, ...publicRow } = row;
  return publicRow;
}

const resolveDeviceSpecTeamMiddleware: AppMiddleware = async (c, next) => {
  const id = c.req.param("id") as string;
  const spec = await db.query.deviceSpecs.findFirst({
    where: eq(deviceSpecs.id, id),
  });
  if (!spec) throw notFound("機材仕様が見つかりません");
  c.set("_targetTeamId", spec.teamId);
  await next();
};

const resolveTeamTournamentScopeMiddleware: AppMiddleware = async (c, next) => {
  const teamId = c.req.param("teamId") as string;
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (team) {
    c.set("_targetTournamentId", team.tournamentId);
  }
  await next();
};

async function assertTeamExists(teamId: string) {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) throw notFound("チームが見つかりません");
}

// GET /api/teams/:teamId/device-specs - 機材仕様一覧 (team_viewer)
const listDeviceSpecs = createRoute({
  method: "get",
  path: "/teams/{teamId}/device-specs",
  tags: ["device-specs"],
  middleware: [
    resolveTeamTournamentScopeMiddleware,
    requireTeamViewer("teamId"),
  ] as const,
  request: {
    params: z.object({ teamId: z.string() }),
    query: z.object({ include_archived: z.string().optional() }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(
            z.union([deviceSpecResponseSchema, publicDeviceSpecResponseSchema]),
          ),
        },
      },
      description: "機材仕様一覧",
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
app.openapi(listDeviceSpecs, async (c) => {
  const { teamId } = c.req.valid("param");
  const { include_archived } = c.req.valid("query");
  const authCtx = c.get("auth");
  const isOwnTeamOrOperator =
    authCtx?.userRole === "operator" || authCtx?.teamId === teamId;
  const shouldIncludeArchived =
    include_archived === "true" && isOwnTeamOrOperator;
  const rows = await db
    .select()
    .from(deviceSpecs)
    .where(
      shouldIncludeArchived
        ? eq(deviceSpecs.teamId, teamId)
        : and(eq(deviceSpecs.teamId, teamId), isNull(deviceSpecs.archivedAt)),
    );
  const filteredRows = shouldIncludeArchived
    ? rows
    : rows.filter((row) => row.archivedAt === null);
  if (isOwnTeamOrOperator) {
    return c.json(filteredRows, 200);
  }
  return c.json(
    filteredRows.map((row) => toPublicDeviceSpec(row)),
    200,
  );
});

// POST /api/teams/:teamId/device-specs - 機材仕様作成 (team_editor)
const createDeviceSpec = createRoute({
  method: "post",
  path: "/teams/{teamId}/device-specs",
  tags: ["device-specs"],
  middleware: [requireTeamEditor("teamId")] as const,
  request: {
    params: z.object({ teamId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: CreateDeviceSpecSchema.omit({ teamId: true }),
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: deviceSpecResponseSchema } },
      description: "機材仕様作成",
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
app.openapi(createDeviceSpec, async (c) => {
  const { teamId } = c.req.valid("param");
  const body = c.req.valid("json");
  await assertTeamExists(teamId);
  const [row] = await db
    .insert(deviceSpecs)
    .values({ ...body, teamId })
    .returning();
  if (!row) throw new Error("insert failed");
  return c.json(row, 201);
});

// PATCH /api/device-specs/:id - 機材仕様更新 (team_editor)
const patchDeviceSpec = createRoute({
  method: "patch",
  path: "/device-specs/{id}",
  tags: ["device-specs"],
  middleware: [
    resolveDeviceSpecTeamMiddleware,
    requireTeamEditor("teamId"),
  ] as const,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: UpdateDeviceSpecSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: deviceSpecResponseSchema } },
      description: "機材仕様更新",
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
app.openapi(patchDeviceSpec, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const [row] = await db
    .update(deviceSpecs)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(deviceSpecs.id, id))
    .returning();
  if (!row) throw notFound("機材仕様が見つかりません");
  return c.json(row, 200);
});

// DELETE /api/device-specs/:id - 機材仕様アーカイブ (soft-delete) (team_editor)
const archiveDeviceSpec = createRoute({
  method: "delete",
  path: "/device-specs/{id}",
  tags: ["device-specs"],
  middleware: [
    resolveDeviceSpecTeamMiddleware,
    requireTeamEditor("teamId"),
  ] as const,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: archiveResponseSchema } },
      description: "アーカイブ成功",
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
app.openapi(archiveDeviceSpec, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db
    .update(deviceSpecs)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(deviceSpecs.id, id), isNull(deviceSpecs.archivedAt)))
    .returning();
  if (!row)
    throw notFound(
      "機材仕様が見つかりません（すでにアーカイブ済みの可能性があります）",
    );
  return c.json({ message: "アーカイブしました", id: row.id }, 200);
});

// POST /api/device-specs/:id/restore - アーカイブ解除 (team_editor)
const restoreDeviceSpec = createRoute({
  method: "post",
  path: "/device-specs/{id}/restore",
  tags: ["device-specs"],
  middleware: [
    resolveDeviceSpecTeamMiddleware,
    requireTeamEditor("teamId"),
  ] as const,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: archiveResponseSchema } },
      description: "復元成功",
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
app.openapi(restoreDeviceSpec, async (c) => {
  const { id } = c.req.valid("param");
  const [row] = await db
    .update(deviceSpecs)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(deviceSpecs.id, id), isNotNull(deviceSpecs.archivedAt)))
    .returning();
  if (!row)
    throw notFound(
      "機材仕様が見つかりません（すでに復元済みの可能性があります）",
    );
  return c.json({ message: "復元しました", id: row.id }, 200);
});

export default app;
