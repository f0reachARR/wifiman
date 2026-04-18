import { OpenAPIHono } from '@hono/zod-openapi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/errors.js';

process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/wifiman_test';
process.env.BETTER_AUTH_SECRET ??= 'test-secret-key-minimum-length';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.APP_ORIGIN ??= 'http://localhost:5173';

type MockRow = Record<string, unknown>;

type MockState = {
  selectQueue: MockRow[][];
  findFirstQueue: {
    issueReports: Array<MockRow | null>;
    wifiConfigs: Array<MockRow | null>;
    teams: Array<MockRow | null>;
    deviceSpecs: Array<MockRow | null>;
  };
};

const { mockDb, state } = vi.hoisted(() => {
  const mockState: MockState = {
    selectQueue: [],
    findFirstQueue: {
      issueReports: [],
      wifiConfigs: [],
      teams: [],
      deviceSpecs: [],
    },
  };

  const db = {
    query: {
      issueReports: {
        findFirst: vi.fn(async () => mockState.findFirstQueue.issueReports.shift() ?? null),
      },
      wifiConfigs: {
        findFirst: vi.fn(async () => mockState.findFirstQueue.wifiConfigs.shift() ?? null),
      },
      teams: {
        findFirst: vi.fn(async () => mockState.findFirstQueue.teams.shift() ?? null),
      },
      deviceSpecs: {
        findFirst: vi.fn(async () => mockState.findFirstQueue.deviceSpecs.shift() ?? null),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => mockState.selectQueue.shift() ?? []),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => []),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => []),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
  };

  return { mockDb: db, state: mockState };
});

vi.mock('../../src/db/index.js', () => ({ db: mockDb }));

async function createTestApp() {
  const [
    { default: issueReportRoutes },
    { default: wifiConfigRoutes },
    { default: deviceSpecRoutes },
  ] = await Promise.all([
    import('../../src/routes/issueReports.js'),
    import('../../src/routes/wifiConfigs.js'),
    import('../../src/routes/deviceSpecs.js'),
  ]);

  const app = new OpenAPIHono();

  app.use('/api/*', async (c, next) => {
    const rawAuth = c.req.header('x-test-auth');
    c.set('auth', rawAuth ? JSON.parse(rawAuth) : {});
    await next();
  });

  app.route('/api', issueReportRoutes);
  app.route('/api', wifiConfigRoutes);
  app.route('/api', deviceSpecRoutes);
  app.onError(errorHandler);

  return app;
}

const ids = {
  tournamentA: '00000000-0000-4000-8000-000000000001',
  teamA: '00000000-0000-4000-8000-000000000011',
  teamB: '00000000-0000-4000-8000-000000000012',
  issueA: '00000000-0000-4000-8000-000000000021',
  issueB: '00000000-0000-4000-8000-000000000022',
  issuePublic: '00000000-0000-4000-8000-000000000023',
  wifiA: '00000000-0000-4000-8000-000000000031',
  wifiB: '00000000-0000-4000-8000-000000000032',
  deviceA: '00000000-0000-4000-8000-000000000041',
  deviceB: '00000000-0000-4000-8000-000000000042',
};

function participantAuth(teamId: string, teamAccessRole: 'viewer' | 'editor') {
  return { teamId, teamAccessRole };
}

beforeEach(() => {
  state.selectQueue = [];
  state.findFirstQueue.issueReports = [];
  state.findFirstQueue.wifiConfigs = [];
  state.findFirstQueue.teams = [];
  state.findFirstQueue.deviceSpecs = [];
  vi.clearAllMocks();
});

describe('security boundaries integration', () => {
  it('他チームの wifiConfigs / deviceSpecs 一覧は公開フィールドのみ返す', async () => {
    const app = await createTestApp();

    state.selectQueue.push([
      {
        id: ids.wifiB,
        teamId: ids.teamB,
        name: 'Team-B Control',
        purpose: 'control',
        band: '5GHz',
        channel: 36,
        channelWidthMHz: 80,
        role: 'primary',
        status: 'active',
        apDeviceId: ids.deviceB,
        clientDeviceId: null,
        expectedDistanceCategory: 'mid',
        pingTargetIp: '192.168.10.1',
        notes: 'secret notes',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    state.selectQueue.push([
      {
        id: ids.deviceB,
        teamId: ids.teamB,
        vendor: 'Vendor-B',
        model: 'Model-B',
        kind: 'ap',
        supportedBands: ['5GHz'],
        notes: 'private note',
        knownIssues: '公開してよい既知課題',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        archivedAt: new Date('2026-04-02T00:00:00.000Z'),
      },
      {
        id: ids.deviceA,
        teamId: ids.teamB,
        vendor: 'Vendor-B',
        model: 'Model-B2',
        kind: 'client',
        supportedBands: ['5GHz'],
        notes: 'private note 2',
        knownIssues: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        archivedAt: null,
      },
    ]);

    const auth = JSON.stringify(participantAuth(ids.teamA, 'viewer'));

    const wifiRes = await app.request(`/api/teams/${ids.teamB}/wifi-configs`, {
      method: 'GET',
      headers: { 'x-test-auth': auth },
    });
    expect(wifiRes.status).toBe(200);
    const wifiBody = (await wifiRes.json()) as Array<Record<string, unknown>>;
    expect(wifiBody).toHaveLength(1);
    expect(wifiBody[0]?.pingTargetIp).toBeUndefined();
    expect(wifiBody[0]?.notes).toBeUndefined();

    const deviceRes = await app.request(
      `/api/teams/${ids.teamB}/device-specs?include_archived=true`,
      {
        method: 'GET',
        headers: { 'x-test-auth': auth },
      },
    );
    expect(deviceRes.status).toBe(200);
    const deviceBody = (await deviceRes.json()) as Array<Record<string, unknown>>;
    expect(deviceBody).toHaveLength(1);
    expect(deviceBody[0]?.notes).toBeUndefined();
    expect(deviceBody[0]?.archivedAt).toBeUndefined();
  });

  it('issueReport 更新で teamId 偽装を拒否する', async () => {
    const app = await createTestApp();

    state.findFirstQueue.issueReports.push({
      id: ids.issueA,
      tournamentId: ids.tournamentA,
      teamId: ids.teamA,
      wifiConfigId: ids.wifiA,
      severity: 'medium',
    });

    const res = await app.request(`/api/issue-reports/${ids.issueA}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-test-auth': JSON.stringify(participantAuth(ids.teamA, 'editor')),
      },
      body: JSON.stringify({ teamId: ids.teamB }),
    });

    expect(res.status).toBe(403);
  });

  it('wifiConfig 作成で他チームの device 指定を拒否する', async () => {
    const app = await createTestApp();

    state.selectQueue.push([]);
    state.findFirstQueue.deviceSpecs.push({
      id: ids.deviceB,
      teamId: ids.teamB,
      model: 'Other Team AP',
    });

    const res = await app.request(`/api/teams/${ids.teamA}/wifi-configs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-auth': JSON.stringify(participantAuth(ids.teamA, 'editor')),
      },
      body: JSON.stringify({
        name: 'Control Main',
        purpose: 'control',
        band: '5GHz',
        channel: 36,
        channelWidthMHz: 80,
        role: 'primary',
        status: 'active',
        apDeviceId: ids.deviceB,
      }),
    });

    expect(res.status).toBe(422);
  });

  it('公開報告可視性: 参加者は自チーム報告 + 公開報告のみ閲覧できる', async () => {
    const app = await createTestApp();

    state.selectQueue.push([
      {
        id: ids.issueA,
        tournamentId: ids.tournamentA,
        teamId: ids.teamA,
      },
      {
        id: ids.issueB,
        tournamentId: ids.tournamentA,
        teamId: ids.teamB,
      },
      {
        id: ids.issuePublic,
        tournamentId: ids.tournamentA,
        teamId: null,
      },
    ]);

    const res = await app.request(`/api/tournaments/${ids.tournamentA}/issue-reports`, {
      method: 'GET',
      headers: { 'x-test-auth': JSON.stringify(participantAuth(ids.teamA, 'viewer')) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string }>;
    expect(body.map((r) => r.id)).toEqual([ids.issueA, ids.issuePublic]);
  });
});
