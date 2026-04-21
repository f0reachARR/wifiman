import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperatorSessionContract } from '../../../src/contracts.js';
import { teamAccesses, teams, tournaments } from '../../../src/db/schema/index.js';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb.js';

process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/wifiman_test';
process.env.BETTER_AUTH_SECRET ??= 'test-secret-key-minimum-length';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.APP_ORIGIN ??= 'http://localhost:5173';
process.env.DEV_OPERATOR_AUTH_ENABLED ??= 'true';
process.env.DEV_OPERATOR_AUTH_PASSPHRASE ??= 'local-dev-passphrase';

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

describe('auth session routes integration (pglite)', () => {
  let authSessionRoutes: Awaited<typeof import('../../../src/routes/authSessions.js')>['default'];
  let errorHandler: Awaited<typeof import('../../../src/errors.js')>['errorHandler'];
  let setAuthContext: Awaited<typeof import('../../../src/middleware/auth.js')>['setAuthContext'];
  let createOpenApiApp: Awaited<typeof import('../../../src/openapi.js')>['createOpenApiApp'];
  let createTeamAccessSessionCookie: Awaited<
    typeof import('../../../src/teamAccessSession.js')
  >['createTeamAccessSessionCookie'];

  beforeAll(async () => {
    state.db = await createTestDatabase();
    [
      { default: authSessionRoutes },
      { errorHandler },
      { setAuthContext },
      { createOpenApiApp },
      { createTeamAccessSessionCookie },
    ] = await Promise.all([
      import('../../../src/routes/authSessions.js'),
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

  it('GET /api/auth/session: 有効な team_access_session cookie から teamAccessId 付きで復元できる', async () => {
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
      role: 'viewer',
      revokedAt: null,
      lastUsedAt: null,
    });

    const app = createOpenApiApp();
    app.use('/api/*', setAuthContext);
    app.route('/api', authSessionRoutes);
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

    const res = await app.request('/api/auth/session', {
      method: 'GET',
      headers: {
        cookie: `team_access_session=${sessionCookie}`,
      },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      kind: 'team',
      role: 'viewer',
      teamId,
      tournamentId,
      teamAccessId,
    });

    const updated = await state.db.db.query.teamAccesses.findFirst({
      where: eq(teamAccesses.id, teamAccessId),
    });
    expect(updated?.lastUsedAt).toBeTruthy();
  });

  it('POST /api/auth/dev-operator-session: 開発フラグ有効時だけ cookie ベースで運営 session を作成できる', async () => {
    const app = createOpenApiApp();
    app.use('/api/*', setAuthContext);
    app.route('/api', authSessionRoutes);
    app.onError(errorHandler);

    const signInRes = await app.request('/api/auth/dev-operator-session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'Local Operator',
        passphrase: 'local-dev-passphrase',
      }),
    });

    expect(signInRes.status).toBe(200);
    const body = (await signInRes.json()) as OperatorSessionContract;
    expect(body).toMatchObject({
      kind: 'operator',
      role: 'operator',
      displayName: 'Local Operator',
    });
    expect(body.sessionId).toEqual(expect.any(String));

    const setCookie = signInRes.headers.get('set-cookie');
    expect(setCookie).toContain('operator_dev_session=');

    const sessionRes = await app.request('/api/auth/session', {
      method: 'GET',
      headers: {
        cookie: setCookie ?? '',
      },
    });

    expect(sessionRes.status).toBe(200);
    await expect(sessionRes.json()).resolves.toMatchObject({
      kind: 'operator',
      role: 'operator',
      displayName: 'Local Operator',
      sessionId: body.sessionId,
    });
  });
});
