import type { SyncRecord, SyncRecordStatus } from '@wifiman/shared';
import Dexie, { type Table } from 'dexie';

export type SyncRecordEntry = SyncRecord & {
  queuedAt: string;
  lastAttemptAt?: string;
};

export type ViewCacheEntry = {
  key: string;
  resource: string;
  scope: 'public' | 'team' | 'operator';
  payload: unknown;
  updatedAt: string;
  expiresAt?: string;
};

export type SyncOverview = {
  total: number;
  pending: number;
  failed: number;
  lastUpdatedAt: string | null;
};

export class AppDatabase extends Dexie {
  syncRecords!: Table<SyncRecordEntry, string>;
  viewCache!: Table<ViewCacheEntry, string>;

  constructor() {
    super('wifiman-web');

    this.version(1).stores({
      syncRecords: '&id, entityType, entityId, status, updatedAt',
      viewCache: '&key, resource, scope, updatedAt, expiresAt',
    });
  }
}

export const appDb = new AppDatabase();

function countByStatus(records: SyncRecordEntry[], status: SyncRecordStatus) {
  return records.filter((record) => record.status === status).length;
}

export async function getSyncOverview(): Promise<SyncOverview> {
  const records = await appDb.syncRecords.toArray();
  const lastUpdatedAt =
    records.map((record) => record.updatedAt).sort((left, right) => right.localeCompare(left))[0] ??
    null;

  return {
    total: records.length,
    pending: countByStatus(records, 'pending') + countByStatus(records, 'processing'),
    failed: countByStatus(records, 'failed'),
    lastUpdatedAt,
  };
}
