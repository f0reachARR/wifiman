import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appDb,
  findIssueReportSyncRecord,
  getSyncOverview,
  listIssueReportSyncRecords,
  queueIssueReportSync,
  updateSyncRecordAfterAttempt,
} from './appDb.js';

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

  it('不具合報告の pending 同期レコードを payload 付きで保存する', async () => {
    const now = '2026-04-22T12:00:00.000Z';
    const record = await queueIssueReportSync(
      '00000000-0000-4000-8000-000000000001',
      {
        teamId: '00000000-0000-4000-8000-000000000011',
        wifiConfigId: '00000000-0000-4000-8000-000000000021',
        visibility: 'team_private',
        symptom: 'high_latency',
        severity: 'high',
        band: '5GHz',
        channel: 36,
        description: 'offline note',
      },
      now,
    );

    expect(record.status).toBe('pending');
    expect(record.entityType).toBe('issue-report');
    expect(record.payload.description).toBe('offline note');

    await expect(appDb.syncRecords.get(record.id)).resolves.toMatchObject({
      id: record.id,
      entityType: 'issue-report',
      tournamentId: '00000000-0000-4000-8000-000000000001',
      status: 'pending',
      queuedAt: now,
      payload: {
        teamId: '00000000-0000-4000-8000-000000000011',
        wifiConfigId: '00000000-0000-4000-8000-000000000021',
        visibility: 'team_private',
        symptom: 'high_latency',
        severity: 'high',
        band: '5GHz',
        channel: 36,
        description: 'offline note',
      },
    });
  });

  it('再送結果に応じて同期レコード状態を更新する', async () => {
    const record = await queueIssueReportSync('00000000-0000-4000-8000-000000000001', {
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      visibility: 'team_public',
      symptom: 'unstable',
      severity: 'medium',
      band: '5GHz',
      channel: 149,
    });

    await updateSyncRecordAfterAttempt(record.id, {
      status: 'failed',
      errorMessage: 'network error',
      attemptedAt: '2026-04-22T12:05:00.000Z',
    });

    await expect(appDb.syncRecords.get(record.id)).resolves.toMatchObject({
      id: record.id,
      status: 'failed',
      errorMessage: 'network error',
      lastAttemptAt: '2026-04-22T12:05:00.000Z',
    });

    await updateSyncRecordAfterAttempt(record.id, {
      status: 'done',
      attemptedAt: '2026-04-22T12:06:00.000Z',
    });

    await expect(appDb.syncRecords.get(record.id)).resolves.toMatchObject({
      id: record.id,
      status: 'done',
      errorMessage: undefined,
      lastAttemptAt: '2026-04-22T12:06:00.000Z',
    });
  });

  it('不具合報告の同期レコードを teamId と status で一覧取得できる', async () => {
    await queueIssueReportSync('00000000-0000-4000-8000-000000000001', {
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      visibility: 'team_private',
      symptom: 'high_latency',
      severity: 'high',
      band: '5GHz',
      channel: 36,
    });
    const otherRecord = await queueIssueReportSync('00000000-0000-4000-8000-000000000001', {
      teamId: '00000000-0000-4000-8000-000000000099',
      wifiConfigId: '00000000-0000-4000-8000-000000000098',
      visibility: 'team_public',
      symptom: 'unstable',
      severity: 'medium',
      band: '5GHz',
      channel: 149,
    });

    await updateSyncRecordAfterAttempt(otherRecord.id, {
      status: 'failed',
      errorMessage: 'network error',
    });

    await expect(
      listIssueReportSyncRecords({
        tournamentId: '00000000-0000-4000-8000-000000000001',
        teamId: '00000000-0000-4000-8000-000000000011',
        statuses: ['pending', 'processing', 'failed'],
      }),
    ).resolves.toHaveLength(1);
  });

  it('不具合報告の同期レコードを entityId または recordId で取得できる', async () => {
    const record = await queueIssueReportSync('00000000-0000-4000-8000-000000000001', {
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      visibility: 'team_private',
      symptom: 'high_latency',
      severity: 'high',
      band: '5GHz',
      channel: 36,
    });

    await expect(findIssueReportSyncRecord(record.entityId)).resolves.toMatchObject({
      id: record.id,
    });
    await expect(findIssueReportSyncRecord(record.id)).resolves.toMatchObject({
      entityId: record.entityId,
    });
  });
});
