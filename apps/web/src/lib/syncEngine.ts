import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiClientError, apiClient, apiQueryKeys } from './api/client.js';
import {
  findIssueReportSyncRecord,
  type IssueReportSyncRecord,
  listIssueReportSyncRecords,
  updateSyncRecordAfterAttempt,
} from './db/appDb.js';
import { useAuthSession } from './useAuthSession.js';

function getSyncFailureStatus(error: unknown): IssueReportSyncRecord['status'] {
  if (error instanceof ApiClientError) {
    if (error.status === 409) {
      return 'conflict';
    }

    if (error.status === 401 || error.status === 403) {
      return 'pending';
    }
  }

  return 'failed';
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    const payload = error.payload as { error?: { message?: string } } | null;
    return payload?.error?.message ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'sync failed';
}

async function invalidateSyncQueries(queryClient?: QueryClient) {
  if (!queryClient) {
    return;
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: apiQueryKeys.syncOverview }),
    queryClient.invalidateQueries({ queryKey: ['sync-records', 'issue-report'] }),
  ]);
}

async function syncIssueReportRecordInternal(record: IssueReportSyncRecord) {
  await updateSyncRecordAfterAttempt(record.id, {
    status: 'processing',
    errorMessage: undefined,
  });

  try {
    const created = await apiClient.createIssueReport(record.tournamentId, record.payload);

    await updateSyncRecordAfterAttempt(record.id, {
      status: 'done',
      entityId: created.id,
      errorMessage: undefined,
    });
  } catch (error) {
    await updateSyncRecordAfterAttempt(record.id, {
      status: getSyncFailureStatus(error),
      errorMessage: getErrorMessage(error),
    });
  }

  return findIssueReportSyncRecord(record.id);
}

export async function syncIssueReportRecord(recordId: string, queryClient?: QueryClient) {
  const record = await findIssueReportSyncRecord(recordId);

  if (!record) {
    return undefined;
  }

  const updated = await syncIssueReportRecordInternal(record);
  await invalidateSyncQueries(queryClient);
  return updated;
}

export async function syncPendingIssueReports(queryClient?: QueryClient) {
  const records = await listIssueReportSyncRecords({ statuses: ['pending'] });
  const results = [];

  for (const record of records) {
    results.push(await syncIssueReportRecordInternal(record));
  }

  await invalidateSyncQueries(queryClient);

  return results.reduce(
    (summary, record) => {
      if (!record) {
        return summary;
      }

      summary.attempted += 1;

      if (record.status === 'done') {
        summary.synced += 1;
      } else if (record.status === 'conflict') {
        summary.conflicted += 1;
      } else if (record.status === 'failed') {
        summary.failed += 1;
      }

      return summary;
    },
    { attempted: 0, synced: 0, conflicted: 0, failed: 0 },
  );
}

export async function flushPendingIssueReportsIfOnline(queryClient?: QueryClient) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return undefined;
  }

  return syncPendingIssueReports(queryClient);
}

export function useAutoSyncPendingIssueReports() {
  const queryClient = useQueryClient();
  const { data: session, isLoading: isSessionLoading } = useAuthSession();

  useEffect(() => {
    if (isSessionLoading || !session) {
      return;
    }

    const run = () => {
      void flushPendingIssueReportsIfOnline(queryClient);
    };

    run();
    window.addEventListener('online', run);

    return () => {
      window.removeEventListener('online', run);
    };
  }, [isSessionLoading, queryClient, session]);
}
