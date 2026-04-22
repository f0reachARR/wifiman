import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appDb, queueIssueReportSync } from './db/appDb.js';

vi.mock('./useAuthSession.js', () => ({
  useAuthSession: () => ({ data: null, isLoading: false }),
}));

import {
  flushPendingIssueReportsIfOnline,
  syncIssueReportRecord,
  syncPendingIssueReports,
} from './syncEngine.js';

describe('sync engine', () => {
  beforeEach(async () => {
    await appDb.syncRecords.clear();
    await appDb.viewCache.clear();
  });

  afterEach(async () => {
    await appDb.syncRecords.clear();
    await appDb.viewCache.clear();
    vi.unstubAllGlobals();
  });

  it('pending issue report を同期成功時に done へ更新する', async () => {
    const record = await queueIssueReportSync('00000000-0000-4000-8000-000000000001', {
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      visibility: 'team_private',
      symptom: 'high_latency',
      severity: 'high',
      band: '5GHz',
      channel: 36,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: '00000000-0000-4000-8000-000000000099',
              tournamentId: '00000000-0000-4000-8000-000000000001',
              teamId: '00000000-0000-4000-8000-000000000011',
              wifiConfigId: '00000000-0000-4000-8000-000000000021',
              visibility: 'team_private',
              band: '5GHz',
              channel: 36,
              symptom: 'high_latency',
              severity: 'high',
              createdAt: '2026-04-22T10:00:00.000Z',
              updatedAt: '2026-04-22T10:00:00.000Z',
            }),
            { status: 201, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    const synced = await syncIssueReportRecord(record.id);

    expect(synced?.status).toBe('done');
    expect(synced?.entityId).toBe('00000000-0000-4000-8000-000000000099');
    await expect(appDb.syncRecords.get(record.id)).resolves.toMatchObject({
      status: 'done',
      entityId: '00000000-0000-4000-8000-000000000099',
      errorMessage: undefined,
    });
  });

  it('409 応答は conflict として保存する', async () => {
    const record = await queueIssueReportSync('00000000-0000-4000-8000-000000000001', {
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      visibility: 'team_private',
      symptom: 'high_latency',
      severity: 'high',
      band: '5GHz',
      channel: 36,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { code: 'CONFLICT', message: 'server has newer data' } }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    const synced = await syncIssueReportRecord(record.id);

    expect(synced?.status).toBe('conflict');
    expect(synced?.errorMessage).toContain('server has newer data');
  });

  it('401 応答は pending を維持する', async () => {
    const record = await queueIssueReportSync('00000000-0000-4000-8000-000000000001', {
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      visibility: 'team_private',
      symptom: 'high_latency',
      severity: 'high',
      band: '5GHz',
      channel: 36,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    const synced = await syncIssueReportRecord(record.id);

    expect(synced?.status).toBe('pending');
    expect(synced?.errorMessage).toContain('unauthorized');
    await expect(appDb.syncRecords.get(record.id)).resolves.toMatchObject({
      status: 'pending',
      errorMessage: 'unauthorized',
    });
  });

  it('オフライン時は flush を実行しない', async () => {
    await queueIssueReportSync('00000000-0000-4000-8000-000000000001', {
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      visibility: 'team_private',
      symptom: 'high_latency',
      severity: 'high',
      band: '5GHz',
      channel: 36,
    });

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(flushPendingIssueReportsIfOnline()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pending レコードを一括同期する', async () => {
    await queueIssueReportSync('00000000-0000-4000-8000-000000000001', {
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      visibility: 'team_private',
      symptom: 'high_latency',
      severity: 'high',
      band: '5GHz',
      channel: 36,
    });
    await queueIssueReportSync('00000000-0000-4000-8000-000000000001', {
      teamId: '00000000-0000-4000-8000-000000000012',
      wifiConfigId: '00000000-0000-4000-8000-000000000022',
      visibility: 'team_public',
      symptom: 'unstable',
      severity: 'medium',
      band: '5GHz',
      channel: 149,
    });

    let counter = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        counter += 1;

        return new Response(
          JSON.stringify({
            id: `00000000-0000-4000-8000-00000000009${counter}`,
            tournamentId: '00000000-0000-4000-8000-000000000001',
            teamId: `00000000-0000-4000-8000-00000000001${counter}`,
            wifiConfigId: `00000000-0000-4000-8000-00000000002${counter}`,
            visibility: 'team_private',
            band: '5GHz',
            channel: 36,
            symptom: 'high_latency',
            severity: 'high',
            createdAt: '2026-04-22T10:00:00.000Z',
            updatedAt: '2026-04-22T10:00:00.000Z',
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    const result = await syncPendingIssueReports();

    expect(result).toEqual({ attempted: 2, synced: 2, conflicted: 0, failed: 0 });
    await expect(appDb.syncRecords.toArray()).resolves.toSatisfy((records) =>
      records.every((record: { status: string }) => record.status === 'done'),
    );
  });

  it('pending レコードを順番に同期する', async () => {
    await queueIssueReportSync('00000000-0000-4000-8000-000000000001', {
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      visibility: 'team_private',
      symptom: 'high_latency',
      severity: 'high',
      band: '5GHz',
      channel: 36,
    });
    await queueIssueReportSync('00000000-0000-4000-8000-000000000001', {
      teamId: '00000000-0000-4000-8000-000000000012',
      wifiConfigId: '00000000-0000-4000-8000-000000000022',
      visibility: 'team_public',
      symptom: 'unstable',
      severity: 'medium',
      band: '5GHz',
      channel: 149,
    });

    let counter = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    const resolvers: Array<() => void> = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        counter += 1;
        const requestIndex = counter;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);

        await new Promise<void>((resolve) => {
          resolvers.push(() => {
            inFlight -= 1;
            resolve();
          });
        });

        return new Response(
          JSON.stringify({
            id: `00000000-0000-4000-8000-00000000009${requestIndex}`,
            tournamentId: '00000000-0000-4000-8000-000000000001',
            teamId: `00000000-0000-4000-8000-00000000001${requestIndex}`,
            wifiConfigId: `00000000-0000-4000-8000-00000000002${requestIndex}`,
            visibility: 'team_private',
            band: '5GHz',
            channel: 36,
            symptom: 'high_latency',
            severity: 'high',
            createdAt: '2026-04-22T10:00:00.000Z',
            updatedAt: '2026-04-22T10:00:00.000Z',
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    const syncPromise = syncPendingIssueReports();

    await vi.waitFor(() => {
      expect(counter).toBe(1);
      expect(maxInFlight).toBe(1);
      expect(resolvers).toHaveLength(1);
    });

    const firstResolver = resolvers.shift();
    if (!firstResolver) {
      throw new Error('first resolver not found');
    }
    firstResolver();

    await vi.waitFor(() => {
      expect(counter).toBe(2);
      expect(maxInFlight).toBe(1);
      expect(resolvers).toHaveLength(1);
    });

    const secondResolver = resolvers.shift();
    if (!secondResolver) {
      throw new Error('second resolver not found');
    }
    secondResolver();

    const result = await syncPromise;

    expect(result).toEqual({ attempted: 2, synced: 2, conflicted: 0, failed: 0 });
  });
});
