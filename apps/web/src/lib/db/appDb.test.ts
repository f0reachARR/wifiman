import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appDb, getSyncOverview } from './appDb.js';

describe('AppDatabase', () => {
  beforeEach(async () => {
    await appDb.syncRecords.clear();
    await appDb.viewCache.clear();
  });

  afterEach(async () => {
    await appDb.syncRecords.clear();
    await appDb.viewCache.clear();
  });

  it('同期テーブルと閲覧キャッシュテーブルを初期化する', () => {
    expect(appDb.tables.map((table) => table.name)).toEqual(['syncRecords', 'viewCache']);
  });

  it('同期状況の集計を返す', async () => {
    await appDb.syncRecords.bulkAdd([
      {
        id: crypto.randomUUID(),
        entityType: 'team',
        entityId: crypto.randomUUID(),
        action: 'create',
        status: 'pending',
        errorMessage: undefined,
        createdAt: '2026-04-21T10:00:00.000Z',
        updatedAt: '2026-04-21T10:00:00.000Z',
        queuedAt: '2026-04-21T10:00:00.000Z',
      },
      {
        id: crypto.randomUUID(),
        entityType: 'issue-report',
        entityId: crypto.randomUUID(),
        action: 'update',
        status: 'failed',
        errorMessage: 'network error',
        createdAt: '2026-04-21T10:00:00.000Z',
        updatedAt: '2026-04-21T11:00:00.000Z',
        queuedAt: '2026-04-21T10:10:00.000Z',
      },
    ]);

    await expect(getSyncOverview()).resolves.toEqual({
      total: 2,
      pending: 1,
      failed: 1,
      lastUpdatedAt: '2026-04-21T11:00:00.000Z',
    });
  });
});
