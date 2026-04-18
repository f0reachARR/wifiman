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
    tournaments: Array<MockRow | null>;
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
      tournaments: [],
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
      tournaments: {
        findFirst: vi.fn(async () => mockState.findFirstQueue.tournaments.shift() ?? null),
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
      where: vi.fn(() => ({
        returning: vi.fn(async () => []),
      })),
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
    { default: teamRoutes },
    { default: tournamentRoutes },
    { default: observedWifiRoutes },
  ] = await Promise.all([
    import('../../src/routes/issueReports.js'),
    import('../../src/routes/wifiConfigs.js'),
    import('../../src/routes/deviceSpecs.js'),
    import('../../src/routes/teams.js'),
    import('../../src/routes/tournaments.js'),
    import('../../src/routes/observedWifis.js'),
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
  app.route('/api', teamRoutes);
  app.route('/api', tournamentRoutes);
  app.route('/api', observedWifiRoutes);
  app.onError(errorHandler);

  return app;
}

const ids = {
  tournamentA: '00000000-0000-4000-8000-000000000001',
  tournamentB: '00000000-0000-4000-8000-000000000002',
  teamA: '00000000-0000-4000-8000-000000000011',
  teamB: '00000000-0000-4000-8000-000000000012',
  issueA: '00000000-0000-4000-8000-000000000021',
  issueB: '00000000-0000-4000-8000-000000000022',
  issuePublic: '00000000-0000-4000-8000-000000000023',
  wifiA: '00000000-0000-4000-8000-000000000031',
  wifiB: '00000000-0000-4000-8000-000000000032',
  observedA: '00000000-0000-4000-8000-000000000033',
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
  state.findFirstQueue.tournaments = [];
  state.findFirstQueue.deviceSpecs = [];
  vi.clearAllMocks();
});

describe('security boundaries integration', () => {
  it('viewer は他チームの公開情報を閲覧できるが機密はマスクされる', async () => {
    const app = await createTestApp();

    state.findFirstQueue.teams.push({
      id: ids.teamB,
      tournamentId: ids.tournamentA,
      name: 'Team B',
      organization: null,
      pitId: null,
      contactEmail: 'b@example.com',
      displayContactName: 'Team B',
      notes: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    state.selectQueue.push([
      {
        id: ids.wifiB,
        teamId: ids.teamB,
        name: 'Team B Control',
        purpose: 'control',
        band: '5GHz',
        channel: 44,
        channelWidthMHz: 80,
        role: 'primary',
        status: 'active',
        apDeviceId: null,
        clientDeviceId: null,
        expectedDistanceCategory: 'mid',
        pingTargetIp: '10.0.0.1',
        notes: 'private note',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);
    state.selectQueue.push([
      {
        id: ids.deviceB,
        teamId: ids.teamB,
        vendor: 'vendor-b',
        model: 'model-b',
        kind: 'ap',
        supportedBands: ['5GHz'],
        notes: 'secret memo',
        knownIssues: 'known issue summary',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        archivedAt: null,
      },
    ]);

    const auth = JSON.stringify(participantAuth(ids.teamA, 'viewer'));

    const teamRes = await app.request(`/api/teams/${ids.teamB}`, {
      method: 'GET',
      headers: { 'x-test-auth': auth },
    });
    expect(teamRes.status).toBe(200);
    const teamBody = (await teamRes.json()) as Record<string, unknown>;
    expect(teamBody.id).toBe(ids.teamB);
    expect(teamBody).not.toHaveProperty('contactEmail');
    expect(teamBody).not.toHaveProperty('displayContactName');
    expect(teamBody).not.toHaveProperty('notes');

    const wifiRes = await app.request(`/api/teams/${ids.teamB}/wifi-configs`, {
      method: 'GET',
      headers: { 'x-test-auth': auth },
    });
    expect(wifiRes.status).toBe(200);
    const wifiBody = (await wifiRes.json()) as Array<Record<string, unknown>>;
    expect(wifiBody).toHaveLength(1);
    expect(wifiBody[0]?.id).toBe(ids.wifiB);
    expect(wifiBody[0]).not.toHaveProperty('pingTargetIp');
    expect(wifiBody[0]).not.toHaveProperty('notes');

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
    expect(deviceBody[0]?.id).toBe(ids.deviceB);
    expect(deviceBody[0]).not.toHaveProperty('notes');
    expect(deviceBody[0]).not.toHaveProperty('archivedAt');
  });

  it('viewer は issueReport を作成できない (403)', async () => {
    const app = await createTestApp();

    const res = await app.request(`/api/tournaments/${ids.tournamentA}/issue-reports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-auth': JSON.stringify(participantAuth(ids.teamA, 'viewer')),
      },
      body: JSON.stringify({
        band: '5GHz',
        channel: 36,
        symptom: 'high_latency',
        severity: 'medium',
      }),
    });

    expect(res.status).toBe(403);
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

  it('issueReport 作成で大会スコープ外の teamId を拒否する', async () => {
    const app = await createTestApp();

    state.findFirstQueue.teams.push({
      id: ids.teamB,
      tournamentId: ids.tournamentB,
    });

    const res = await app.request(`/api/tournaments/${ids.tournamentA}/issue-reports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-auth': JSON.stringify({ userRole: 'operator' }),
      },
      body: JSON.stringify({
        teamId: ids.teamB,
        band: '5GHz',
        channel: 36,
        symptom: 'high_latency',
        severity: 'medium',
      }),
    });

    expect(res.status).toBe(422);
  });

  it('issueReport 作成の契約: 無権限は 403、大会外参照は 422', async () => {
    const app = await createTestApp();

    const forbiddenRes = await app.request(`/api/tournaments/${ids.tournamentA}/issue-reports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-auth': JSON.stringify(participantAuth(ids.teamA, 'viewer')),
      },
      body: JSON.stringify({
        band: '5GHz',
        channel: 36,
        symptom: 'high_latency',
        severity: 'medium',
      }),
    });
    expect(forbiddenRes.status).toBe(403);

    state.findFirstQueue.teams.push({
      id: ids.teamB,
      tournamentId: ids.tournamentB,
    });
    const unprocessableRes = await app.request(
      `/api/tournaments/${ids.tournamentA}/issue-reports`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-test-auth': JSON.stringify({ userRole: 'operator' }),
        },
        body: JSON.stringify({
          teamId: ids.teamB,
          band: '5GHz',
          channel: 36,
          symptom: 'high_latency',
          severity: 'medium',
        }),
      },
    );
    expect(unprocessableRes.status).toBe(422);
  });

  it('issueReport 作成で operator 経路でも大会スコープ外の wifiConfigId を拒否する', async () => {
    const app = await createTestApp();

    state.findFirstQueue.wifiConfigs.push({
      id: ids.wifiB,
      teamId: ids.teamB,
      band: '5GHz',
      channel: 44,
      channelWidthMHz: 80,
      apDeviceId: null,
      clientDeviceId: null,
    });
    state.findFirstQueue.teams.push({
      id: ids.teamB,
      tournamentId: ids.tournamentB,
    });

    const res = await app.request(`/api/tournaments/${ids.tournamentA}/issue-reports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-auth': JSON.stringify({ userRole: 'operator' }),
      },
      body: JSON.stringify({
        wifiConfigId: ids.wifiB,
        band: '5GHz',
        channel: 36,
        symptom: 'high_latency',
        severity: 'medium',
      }),
    });

    expect(res.status).toBe(422);
  });

  it('wifiConfig delete の契約: 存在しない id は 404', async () => {
    const app = await createTestApp();

    state.findFirstQueue.wifiConfigs.push(null);

    const res = await app.request(`/api/wifi-configs/${ids.wifiB}`, {
      method: 'DELETE',
      headers: {
        'x-test-auth': JSON.stringify(participantAuth(ids.teamA, 'editor')),
      },
    });

    expect(res.status).toBe(404);
  });

  it('通常ログイン user は channel-map / issueReports 一覧・summary を閲覧できない', async () => {
    const app = await createTestApp();
    const auth = JSON.stringify({ userId: 'user-a', userRole: 'user' });

    const channelMapRes = await app.request(`/api/tournaments/${ids.tournamentA}/channel-map`, {
      method: 'GET',
      headers: { 'x-test-auth': auth },
    });
    expect(channelMapRes.status).toBe(403);

    const listRes = await app.request(`/api/tournaments/${ids.tournamentA}/issue-reports`, {
      method: 'GET',
      headers: { 'x-test-auth': auth },
    });
    expect(listRes.status).toBe(403);

    const summaryRes = await app.request(
      `/api/tournaments/${ids.tournamentA}/issue-reports/summary`,
      {
        method: 'GET',
        headers: { 'x-test-auth': auth },
      },
    );
    expect(summaryRes.status).toBe(403);
  });

  it('participant/operator は channel-map / issueReports 一覧・summary を閲覧できる', async () => {
    const app = await createTestApp();
    const authHeaders = [
      JSON.stringify(participantAuth(ids.teamA, 'viewer')),
      JSON.stringify({ userId: 'op-1', userRole: 'operator' }),
    ];

    for (const auth of authHeaders) {
      const channelMapRes = await app.request(`/api/tournaments/${ids.tournamentA}/channel-map`, {
        method: 'GET',
        headers: { 'x-test-auth': auth },
      });
      expect(channelMapRes.status).toBe(404);

      state.selectQueue.push([]);
      const listRes = await app.request(`/api/tournaments/${ids.tournamentA}/issue-reports`, {
        method: 'GET',
        headers: { 'x-test-auth': auth },
      });
      expect(listRes.status).toBe(200);

      state.selectQueue.push([]);
      const summaryRes = await app.request(
        `/api/tournaments/${ids.tournamentA}/issue-reports/summary`,
        {
          method: 'GET',
          headers: { 'x-test-auth': auth },
        },
      );
      expect(summaryRes.status).toBe(200);
    }
  });

  it('observedWifis 公開APIでは notes を返さない', async () => {
    const app = await createTestApp();

    state.selectQueue.push([
      {
        id: ids.observedA,
        tournamentId: ids.tournamentA,
        source: 'wild',
        ssid: 'Free-WiFi',
        bssid: '00:11:22:33:44:55',
        band: '5GHz',
        channel: 36,
        channelWidthMHz: 80,
        rssi: -64,
        locationLabel: 'hall-a',
        observedAt: new Date('2026-04-10T00:00:00.000Z'),
        notes: 'internal observation memo',
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
        updatedAt: new Date('2026-04-10T00:00:00.000Z'),
      },
    ]);

    const res = await app.request(`/api/tournaments/${ids.tournamentA}/observed-wifis`, {
      method: 'GET',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe(ids.observedA);
    expect(body[0]).not.toHaveProperty('notes');
  });
});
