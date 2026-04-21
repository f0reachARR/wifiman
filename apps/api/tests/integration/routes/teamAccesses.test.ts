import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { teamAccesses, teams, tournaments } from '../../../src/db/schema/index.js';
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

describe('team access routes integration (pglite)', () => {
  let teamAccessRoutes: Awaited<typeof import('../../../src/routes/teamAccesses.js')>['default'];
  let errorHandler: Awaited<typeof import('../../../src/errors.js')>['errorHandler'];
  let setAuthContext: Awaited<typeof import('../../../src/middleware/auth.js')>['setAuthContext'];
  let createOpenApiApp: Awaited<typeof import('../../../src/openapi.js')>['createOpenApiApp'];
  let createTeamAccessSessionCookie: Awaited<
    typeof import('../../../src/teamAccessSession.js')
  >['createTeamAccessSessionCookie'];

  beforeAll(async () => {
    state.db = await createTestDatabase();
    [
      { default: teamAccessRoutes },
      { errorHandler },
      { setAuthContext },
      { createOpenApiApp },
      { createTeamAccessSessionCookie },
    ] = await Promise.all([
      import('../../../src/routes/teamAccesses.js'),
      import('../../../src/errors.js'),
      import('../../../src/middleware/auth.js'),
      import('../../../src/openapi.js'),
      import('../../../src/teamAccessSession.js'),
    ]);
  });

  afterAll(async () => {
    await state.db?.close();
  });

  beforeEach(async () => {
    await state.db?.reset();
  });

  it('GET /api/team-accesses/session: 有効な team_access_session cookie で復元できる', async () => {
    if (!state.db) throw new Error('db is not initialized');

    const tournamentId = '00000000-0000-4000-8000-000000000001';
    const teamId = '00000000-0000-4000-8000-000000000011';
    const teamAccessId = '00000000-0000-4000-8000-000000000021';

    await state.db.db.insert(tournaments).values({
      id: tournamentId,
      name: 'Tournament One',
      venueName: 'Venue A',
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      description: null,
    });
    await state.db.db.insert(teams).values({
      id: teamId,
      tournamentId,
      name: 'Team A',
      contactEmail: 'team-a@example.com',
      displayContactName: 'Team A Contact',
    });
    await state.db.db.insert(teamAccesses).values({
      id: teamAccessId,
      teamId,
      email: 'team-a@example.com',
      accessTokenHash: 'hash',
      role: 'editor',
      revokedAt: null,
      lastUsedAt: null,
    });

    const app = createOpenApiApp();
    app.use('/api/*', setAuthContext);
    app.route('/api', teamAccessRoutes);
    app.onError(errorHandler);

    const sessionCookie = createTeamAccessSessionCookie(
      {
        teamAccessId,
        teamId,
        tournamentId,
        role: 'editor',
      },
      60 * 60,
    );

    const res = await app.request('/api/team-accesses/session', {
      method: 'GET',
      headers: {
        cookie: `team_access_session=${sessionCookie}`,
      },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      teamId,
      tournamentId,
      role: 'editor',
    });

    const updated = await state.db.db.query.teamAccesses.findFirst({
      where: eq(teamAccesses.id, teamAccessId),
    });
    expect(updated?.lastUsedAt).toBeTruthy();
  });

  it('GET /api/team-accesses/session: cookie がなければ 401', async () => {
    const app = createOpenApiApp();
    app.use('/api/*', setAuthContext);
    app.route('/api', teamAccessRoutes);
    app.onError(errorHandler);

    const res = await app.request('/api/team-accesses/session', {
      method: 'GET',
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: {
        code: 'UNAUTHORIZED',
      },
    });
  });

  it('GET /api/team-accesses/session: 失効済み team access なら 401', async () => {
    if (!state.db) throw new Error('db is not initialized');

    const tournamentId = '00000000-0000-4000-8000-000000000101';
    const teamId = '00000000-0000-4000-8000-000000000111';
    const teamAccessId = '00000000-0000-4000-8000-000000000121';

    await state.db.db.insert(tournaments).values({
      id: tournamentId,
      name: 'Tournament Revoked',
      venueName: 'Venue R',
      startDate: '2026-04-03',
      endDate: '2026-04-04',
      description: null,
    });
    await state.db.db.insert(teams).values({
      id: teamId,
      tournamentId,
      name: 'Team Revoked',
      contactEmail: 'revoked@example.com',
      displayContactName: 'Revoked Contact',
    });
    await state.db.db.insert(teamAccesses).values({
      id: teamAccessId,
      teamId,
      email: 'revoked@example.com',
      accessTokenHash: 'hash',
      role: 'viewer',
      revokedAt: new Date(),
      lastUsedAt: null,
    });

    const app = createOpenApiApp();
    app.use('/api/*', setAuthContext);
    app.route('/api', teamAccessRoutes);
    app.onError(errorHandler);

    const sessionCookie = createTeamAccessSessionCookie(
      {
        teamAccessId,
        teamId,
        tournamentId,
        role: 'viewer',
      },
      60 * 60,
    );

    const res = await app.request('/api/team-accesses/session', {
      method: 'GET',
      headers: {
        cookie: `team_access_session=${sessionCookie}`,
      },
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: {
        code: 'UNAUTHORIZED',
      },
    });
  });

  it('GET /api/team-accesses/session: cookie の tournamentId が不一致なら 401', async () => {
    if (!state.db) throw new Error('db is not initialized');

    const tournamentId = '00000000-0000-4000-8000-000000000201';
    const wrongTournamentId = '00000000-0000-4000-8000-000000000202';
    const teamId = '00000000-0000-4000-8000-000000000211';
    const teamAccessId = '00000000-0000-4000-8000-000000000221';

    await state.db.db.insert(tournaments).values({
      id: tournamentId,
      name: 'Tournament Actual',
      venueName: 'Venue T',
      startDate: '2026-04-05',
      endDate: '2026-04-06',
      description: null,
    });
    await state.db.db.insert(tournaments).values({
      id: wrongTournamentId,
      name: 'Tournament Wrong',
      venueName: 'Venue W',
      startDate: '2026-04-07',
      endDate: '2026-04-08',
      description: null,
    });
    await state.db.db.insert(teams).values({
      id: teamId,
      tournamentId,
      name: 'Team Mismatch',
      contactEmail: 'mismatch@example.com',
      displayContactName: 'Mismatch Contact',
    });
    await state.db.db.insert(teamAccesses).values({
      id: teamAccessId,
      teamId,
      email: 'mismatch@example.com',
      accessTokenHash: 'hash',
      role: 'editor',
      revokedAt: null,
      lastUsedAt: null,
    });

    const app = createOpenApiApp();
    app.use('/api/*', setAuthContext);
    app.route('/api', teamAccessRoutes);
    app.onError(errorHandler);

    const sessionCookie = createTeamAccessSessionCookie(
      {
        teamAccessId,
        teamId,
        tournamentId: wrongTournamentId,
        role: 'editor',
      },
      60 * 60,
    );

    const res = await app.request('/api/team-accesses/session', {
      method: 'GET',
      headers: {
        cookie: `team_access_session=${sessionCookie}`,
      },
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: {
        code: 'UNAUTHORIZED',
      },
    });

    const updated = await state.db.db.query.teamAccesses.findFirst({
      where: eq(teamAccesses.id, teamAccessId),
    });
    expect(updated?.lastUsedAt).toBeNull();
  });
});
