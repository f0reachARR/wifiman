import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { teams, tournaments } from '../../../src/db/schema/index.js';
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

describe('teams routes integration (pglite)', () => {
  let teamRoutes: Awaited<typeof import('../../../src/routes/teams.js')>['default'];

  beforeAll(async () => {
    state.db = await createTestDatabase();
    ({ default: teamRoutes } = await import('../../../src/routes/teams.js'));
  });

  afterAll(async () => {
    await state.db?.close();
  });

  beforeEach(async () => {
    await state.db?.reset();
  });

  it('GET /api/tournaments/:id/teams: 正常系', async () => {
    if (!state.db) throw new Error('db is not initialized');

    const tournamentId = '00000000-0000-4000-8000-000000000001';
    await state.db.db.insert(tournaments).values({
      id: tournamentId,
      name: 'Tournament One',
      venueName: 'Venue A',
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      description: null,
    });

    await state.db.db.insert(teams).values([
      {
        id: '00000000-0000-4000-8000-000000000011',
        tournamentId,
        name: 'Team A',
        contactEmail: 'team-a@example.com',
        displayContactName: 'Team A Contact',
      },
      {
        id: '00000000-0000-4000-8000-000000000012',
        tournamentId,
        name: 'Team B',
        contactEmail: 'team-b@example.com',
        displayContactName: 'Team B Contact',
      },
    ]);

    const app = createIntegrationTestApp();
    app.route('/api', teamRoutes);

    const res = await app.request(`/api/tournaments/${tournamentId}/teams`, {
      method: 'GET',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(2);
    const teamA = body.find((row) => row.id === '00000000-0000-4000-8000-000000000011');
    expect(teamA?.name).toBe('Team A');
    expect(teamA).not.toHaveProperty('contactEmail');
    expect(teamA).not.toHaveProperty('displayContactName');
  });

  it('POST /api/tournaments/:id/teams: operator は作成成功', async () => {
    if (!state.db) throw new Error('db is not initialized');

    const tournamentId = '00000000-0000-4000-8000-000000000002';
    await state.db.db.insert(tournaments).values({
      id: tournamentId,
      name: 'Tournament Two',
      venueName: 'Venue B',
      startDate: '2026-05-01',
      endDate: '2026-05-02',
      description: null,
    });

    const app = createIntegrationTestApp();
    app.route('/api', teamRoutes);

    const res = await app.request(`/api/tournaments/${tournamentId}/teams`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-auth': JSON.stringify({
          userId: 'user-operator',
          userRole: 'operator',
        }),
      },
      body: JSON.stringify({
        name: 'Team New',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      name: string;
      tournamentId: string;
    };
    expect(body.name).toBe('Team New');
    expect(body.tournamentId).toBe(tournamentId);

    const inserted = await state.db.db.query.teams.findFirst({
      where: eq(teams.id, body.id),
    });
    expect(inserted?.name).toBe('Team New');
    expect(inserted?.tournamentId).toBe(tournamentId);
  });

  it('POST /api/tournaments/:id/teams: 未認証は 401', async () => {
    if (!state.db) throw new Error('db is not initialized');

    const tournamentId = '00000000-0000-4000-8000-000000000004';
    await state.db.db.insert(tournaments).values({
      id: tournamentId,
      name: 'Tournament Four',
      venueName: 'Venue D',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      description: null,
    });

    const app = createIntegrationTestApp();
    app.route('/api', teamRoutes);

    const res = await app.request(`/api/tournaments/${tournamentId}/teams`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Team Unauthorized',
      }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/tournaments/:id/teams: non-operator は 403', async () => {
    if (!state.db) throw new Error('db is not initialized');

    const tournamentId = '00000000-0000-4000-8000-000000000003';
    await state.db.db.insert(tournaments).values({
      id: tournamentId,
      name: 'Tournament Three',
      venueName: 'Venue C',
      startDate: '2026-06-01',
      endDate: '2026-06-02',
      description: null,
    });

    const app = createIntegrationTestApp();
    app.route('/api', teamRoutes);

    const res = await app.request(`/api/tournaments/${tournamentId}/teams`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-auth': JSON.stringify({
          userId: 'user-normal',
          userRole: 'user',
        }),
      },
      body: JSON.stringify({
        name: 'Team Forbidden',
      }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('FORBIDDEN');

    const createdTeams = await state.db.db
      .select()
      .from(teams)
      .where(eq(teams.tournamentId, tournamentId));
    expect(createdTeams).toHaveLength(0);
  });

  it('POST /api/tournaments/:id/teams: 大会なしは 404', async () => {
    if (!state.db) throw new Error('db is not initialized');

    const app = createIntegrationTestApp();
    app.route('/api', teamRoutes);

    const res = await app.request('/api/tournaments/00000000-0000-4000-8000-000000000099/teams', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-auth': JSON.stringify({
          userId: 'user-operator',
          userRole: 'operator',
        }),
      },
      body: JSON.stringify({
        name: 'Team Missing Tournament',
      }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  it('POST /api/tournaments/:id/teams: 同名競合は 409', async () => {
    if (!state.db) throw new Error('db is not initialized');

    const tournamentId = '00000000-0000-4000-8000-000000000005';
    await state.db.db.insert(tournaments).values({
      id: tournamentId,
      name: 'Tournament Five',
      venueName: 'Venue E',
      startDate: '2026-08-01',
      endDate: '2026-08-02',
      description: null,
    });
    await state.db.db.insert(teams).values({
      id: '00000000-0000-4000-8000-000000000051',
      tournamentId,
      name: 'Team Duplicate',
      organization: null,
      pitId: null,
      contactEmail: null,
      displayContactName: null,
      notes: null,
    });

    const app = createIntegrationTestApp();
    app.route('/api', teamRoutes);

    const res = await app.request(`/api/tournaments/${tournamentId}/teams`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-auth': JSON.stringify({
          userId: 'user-operator',
          userRole: 'operator',
        }),
      },
      body: JSON.stringify({
        name: 'Team Duplicate',
      }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('CONFLICT');
  });

  it('POST /api/tournaments/:id/teams: バリデーション不正は 400', async () => {
    if (!state.db) throw new Error('db is not initialized');

    const tournamentId = '00000000-0000-4000-8000-000000000006';
    await state.db.db.insert(tournaments).values({
      id: tournamentId,
      name: 'Tournament Six',
      venueName: 'Venue F',
      startDate: '2026-09-01',
      endDate: '2026-09-02',
      description: null,
    });

    const app = createIntegrationTestApp();
    app.route('/api', teamRoutes);

    const res = await app.request(`/api/tournaments/${tournamentId}/teams`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-auth': JSON.stringify({
          userId: 'user-operator',
          userRole: 'operator',
        }),
      },
      body: JSON.stringify({
        name: '',
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });
});
