import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  issueReports,
  notices,
  teams,
  tournaments,
  wifiConfigs,
} from '../../../src/db/schema/index.js';
import { createIntegrationTestApp } from '../helpers/testApp.js';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb.js';

process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/wifiman_test';
process.env.BETTER_AUTH_SECRET ??= 'test-secret-key-minimum-length';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.APP_ORIGIN ??= 'http://localhost:5173';

type TestState = {
  db: TestDatabase | null;
};

const state = vi.hoisted<TestState>(() => ({
  db: null,
}));

vi.mock('../../../src/db/index.js', () => ({
  get db() {
    if (!state.db) {
      throw new Error('Test DB is not initialized');
    }
    return state.db.db;
  },
}));

describe('tournaments routes integration (pglite)', () => {
  let tournamentRoutes: Awaited<typeof import('../../../src/routes/tournaments.js')>['default'];

  beforeAll(async () => {
    state.db = await createTestDatabase();
    ({ default: tournamentRoutes } = await import('../../../src/routes/tournaments.js'));
  });

  beforeEach(async () => {
    await state.db?.reset();
  });

  it('GET /api/tournaments/:id/public-overview: 公開サマリを返す', async () => {
    if (!state.db) throw new Error('db is not initialized');

    const tournamentId = '00000000-0000-4000-8000-000000000001';
    const teamId = '00000000-0000-4000-8000-000000000011';

    await state.db.db.insert(tournaments).values({
      id: tournamentId,
      name: 'Spring Cup',
      venueName: 'East Hall',
      startDate: '2026-04-21',
      endDate: '2026-04-22',
      description: 'Public overview target',
    });

    await state.db.db.insert(teams).values({
      id: teamId,
      tournamentId,
      name: 'Alpha',
      organization: 'A School',
      pitId: 'P-01',
      contactEmail: 'alpha@example.com',
      displayContactName: 'Alpha Rep',
      notes: null,
    });

    await state.db.db.insert(wifiConfigs).values([
      {
        id: '00000000-0000-4000-8000-000000000021',
        teamId,
        name: 'Control 5G',
        purpose: 'control',
        band: '5GHz',
        channel: 36,
        channelWidthMHz: 80,
        role: 'primary',
        status: 'active',
        apDeviceId: null,
        clientDeviceId: null,
        expectedDistanceCategory: 'mid',
        pingTargetIp: null,
        notes: null,
      },
      {
        id: '00000000-0000-4000-8000-000000000022',
        teamId,
        name: 'Backup 2.4G',
        purpose: 'debug',
        band: '2.4GHz',
        channel: 6,
        channelWidthMHz: 20,
        role: 'backup',
        status: 'standby',
        apDeviceId: null,
        clientDeviceId: null,
        expectedDistanceCategory: 'near',
        pingTargetIp: null,
        notes: null,
      },
      {
        id: '00000000-0000-4000-8000-000000000023',
        teamId,
        name: 'Disabled 6G',
        purpose: 'other',
        band: '6GHz',
        channel: 5,
        channelWidthMHz: 80,
        role: 'backup',
        status: 'disabled',
        apDeviceId: null,
        clientDeviceId: null,
        expectedDistanceCategory: null,
        pingTargetIp: null,
        notes: null,
      },
    ]);

    await state.db.db.insert(issueReports).values({
      id: '00000000-0000-4000-8000-000000000031',
      tournamentId,
      teamId,
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      reporterName: null,
      visibility: 'team_public',
      band: '5GHz',
      channel: 36,
      channelWidthMHz: 80,
      symptom: 'high_latency',
      severity: 'medium',
      avgPingMs: null,
      maxPingMs: null,
      packetLossPercent: null,
      distanceCategory: null,
      estimatedDistanceMeters: null,
      locationLabel: null,
      reproducibility: null,
      description: null,
      mitigationTried: null,
      improved: null,
      apDeviceModel: null,
      clientDeviceModel: null,
    });

    await state.db.db.insert(notices).values({
      id: '00000000-0000-4000-8000-000000000041',
      tournamentId,
      title: 'Bring backup radios',
      body: 'Check spare units before qualification.',
      severity: 'warning',
      publishedAt: new Date('2026-04-20T00:00:00.000Z'),
      expiresAt: null,
    });

    const app = createIntegrationTestApp();
    app.route('/api', tournamentRoutes);

    const response = await app.request(`/api/tournaments/${tournamentId}/public-overview`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      tournament: {
        id: tournamentId,
        name: 'Spring Cup',
      },
      teamCount: 1,
      wifiConfigSummary: {
        '2.4GHz': 1,
        '5GHz': 1,
        '6GHz': 0,
      },
      publicIssueReportCount: 1,
      noticeCount: 1,
    });
  });
});
