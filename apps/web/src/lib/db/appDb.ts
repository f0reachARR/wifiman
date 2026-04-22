import type { SyncRecord, SyncRecordStatus } from '@wifiman/shared';
import Dexie, { type Table } from 'dexie';
import type { IssueReportCreateInput, IssueReportUpdateInput } from '../api/client.js';

export type SyncRecordEntry = SyncRecord & {
  queuedAt: string;
  lastAttemptAt?: string;
  payload?: unknown;
};

export type IssueReportSyncRecord = SyncRecordEntry & {
  entityType: 'issue-report';
  tournamentId: string;
  payload: IssueReportCreateInput;
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

function getNow() {
  return new Date().toISOString();
}

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

export async function queueIssueReportSync(
  tournamentId: string,
  payload: IssueReportCreateInput,
  queuedAt = getNow(),
): Promise<IssueReportSyncRecord> {
  const entityId = crypto.randomUUID();
  const record: IssueReportSyncRecord = {
    id: crypto.randomUUID(),
    entityType: 'issue-report',
    tournamentId,
    entityId,
    action: 'create',
    status: 'pending',
    errorMessage: undefined,
    createdAt: queuedAt,
    updatedAt: queuedAt,
    queuedAt,
    payload,
  };

  await appDb.syncRecords.put(record);

  return record;
}

type SyncAttemptUpdate = {
  status: SyncRecordStatus;
  attemptedAt?: string;
  errorMessage?: string | undefined;
  entityId?: string;
};

export async function updateSyncRecordAfterAttempt(recordId: string, update: SyncAttemptUpdate) {
  const record = await appDb.syncRecords.get(recordId);

  if (!record) {
    return;
  }

  const attemptedAt = update.attemptedAt ?? getNow();
  await appDb.syncRecords.put({
    ...record,
    status: update.status,
    errorMessage: update.errorMessage,
    entityId: update.entityId ?? record.entityId,
    lastAttemptAt: attemptedAt,
    updatedAt: attemptedAt,
  });
}

function asIssueReportSyncRecord(record?: SyncRecordEntry) {
  if (!record || record.entityType !== 'issue-report' || !record.payload) {
    return null;
  }

  return record as IssueReportSyncRecord;
}

type ListIssueReportSyncRecordOptions = {
  tournamentId?: string;
  teamId?: string;
  statuses?: ReadonlyArray<SyncRecordStatus>;
};

export async function listIssueReportSyncRecords(options: ListIssueReportSyncRecordOptions = {}) {
  const records = await appDb.syncRecords.toArray();

  return records
    .map((record) => asIssueReportSyncRecord(record))
    .filter((record): record is IssueReportSyncRecord => record != null)
    .filter((record) => {
      if (options.tournamentId && record.tournamentId !== options.tournamentId) {
        return false;
      }
      if (options.teamId && record.payload.teamId !== options.teamId) {
        return false;
      }
      if (options.statuses && !options.statuses.includes(record.status)) {
        return false;
      }

      return true;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function findIssueReportSyncRecord(identifier: string) {
  const record = await appDb.syncRecords.get(identifier);
  const directMatch = asIssueReportSyncRecord(record);

  if (directMatch) {
    return directMatch;
  }

  const byEntityId = await appDb.syncRecords.where('entityId').equals(identifier).first();

  return asIssueReportSyncRecord(byEntityId);
}

export async function findIssueReportSyncRecordByEntityId(entityId: string) {
  const record = await findIssueReportSyncRecord(entityId);

  return record;
}

export async function updateIssueReportSyncPayload(
  recordId: string,
  patch: IssueReportUpdateInput,
  updatedAt = getNow(),
) {
  const record = await appDb.syncRecords.get(recordId);

  if (!record || record.entityType !== 'issue-report' || !record.payload) {
    return undefined;
  }

  const nextPayload = { ...(record.payload as IssueReportCreateInput) };

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete nextPayload[key as keyof IssueReportCreateInput];
      continue;
    }

    Object.assign(nextPayload, {
      [key]: value,
    });
  }

  const nextRecord: IssueReportSyncRecord = {
    ...(record as IssueReportSyncRecord),
    payload: nextPayload,
    updatedAt,
  };

  await appDb.syncRecords.put(nextRecord);
  return nextRecord;
}
