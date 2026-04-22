import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  NativeSelect,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ISSUE_REPORT_VISIBILITIES, REPRODUCIBILITIES } from '@wifiman/shared';
import { useEffect, useMemo, useState } from 'react';
import {
  apiClient,
  type IssueReportCreateInput,
  type IssueReportUpdateInput,
  type IssueReportView,
} from '../lib/api/client.js';
import { canEditTeamResources } from '../lib/authz.js';
import {
  findIssueReportSyncRecord,
  updateIssueReportSyncPayload,
  updateSyncRecordAfterAttempt,
} from '../lib/db/appDb.js';
import { useAuthSession } from '../lib/useAuthSession.js';
import { useIssueReport, useUpdateIssueReportMutation } from '../lib/useTeamManagement.js';

type IssueReportDetailPageProps = {
  tournamentId: string;
  issueReportId: string;
};

type DetailFormValues = {
  visibility: 'team_private' | 'team_public';
  reporterName: string;
  avgPingMs: number | '';
  reproducibility: '' | 'always' | 'sometimes' | 'once';
  locationLabel: string;
  description: string;
};

function isDetailedReport(report: IssueReportView): report is IssueReportView & {
  reporterName?: string | null;
  locationLabel?: string | null;
  description?: string | null;
  reproducibility?: 'always' | 'sometimes' | 'once' | null;
} {
  return 'reporterName' in report || 'locationLabel' in report || 'description' in report;
}

function toInitialFormValues(
  report: IssueReportView | null,
  localPayload?: IssueReportCreateInput,
): DetailFormValues {
  return {
    visibility: (report?.visibility ?? localPayload?.visibility ?? 'team_private') as
      | 'team_private'
      | 'team_public',
    reporterName:
      report && isDetailedReport(report)
        ? (report.reporterName ?? '')
        : (localPayload?.reporterName ?? ''),
    avgPingMs: report?.avgPingMs ?? localPayload?.avgPingMs ?? '',
    reproducibility:
      report && isDetailedReport(report)
        ? ((report.reproducibility ?? '') as DetailFormValues['reproducibility'])
        : ((localPayload?.reproducibility ?? '') as DetailFormValues['reproducibility']),
    locationLabel:
      report && isDetailedReport(report)
        ? (report.locationLabel ?? '')
        : (localPayload?.locationLabel ?? ''),
    description:
      report && isDetailedReport(report)
        ? (report.description ?? '')
        : (localPayload?.description ?? ''),
  };
}

function buildIssueReportPatch(values: DetailFormValues) {
  const reporterName = values.reporterName.trim();
  const locationLabel = values.locationLabel.trim();
  const description = values.description.trim();

  return {
    visibility: values.visibility,
    reporterName: reporterName.length > 0 ? reporterName : null,
    avgPingMs: values.avgPingMs !== '' ? values.avgPingMs : null,
    reproducibility: values.reproducibility || null,
    locationLabel: locationLabel.length > 0 ? locationLabel : null,
    description: description.length > 0 ? description : null,
  } satisfies IssueReportUpdateInput;
}

function buildCreatePayloadForResend(
  payload: IssueReportCreateInput,
  patch: IssueReportUpdateInput,
): IssueReportCreateInput {
  const nextPayload = { ...payload };

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete nextPayload[key as keyof IssueReportCreateInput];
      continue;
    }

    Object.assign(nextPayload, {
      [key]: value,
    });
  }

  return nextPayload;
}

export function IssueReportDetailPage({ tournamentId, issueReportId }: IssueReportDetailPageProps) {
  const navigate = useNavigate();
  const { data: session } = useAuthSession();
  const issueReportQuery = useIssueReport(issueReportId);
  const localSyncQuery = useQuery({
    queryKey: ['local-sync', 'issue-report', issueReportId],
    queryFn: () => findIssueReportSyncRecord(issueReportId),
    retry: false,
  });
  const updateIssueReportMutation = useUpdateIssueReportMutation(issueReportId, tournamentId);
  const resolvedReport = issueReportQuery.data ?? null;
  const localRecord = localSyncQuery.data;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [values, setValues] = useState<DetailFormValues>(() =>
    toInitialFormValues(null, localRecord?.payload),
  );

  useEffect(() => {
    setValues(toInitialFormValues(resolvedReport, localRecord?.payload));
  }, [localRecord?.payload, resolvedReport]);

  const effectiveTeamId = resolvedReport?.teamId ?? localRecord?.payload.teamId ?? '';
  const canEdit = Boolean(effectiveTeamId && canEditTeamResources(session, effectiveTeamId));
  const syncStatus = localRecord?.status ?? 'server_synced';
  const syncBadgeColor =
    syncStatus === 'failed' ? 'red' : syncStatus === 'pending' ? 'orange' : 'teal';
  const sourcePayload = localRecord?.payload;
  const displayReport = useMemo(() => {
    if (resolvedReport) {
      return resolvedReport;
    }

    if (!sourcePayload) {
      return null;
    }

    return {
      id: issueReportId,
      tournamentId: localRecord.tournamentId,
      teamId: sourcePayload.teamId ?? null,
      wifiConfigId: sourcePayload.wifiConfigId ?? null,
      reporterName: sourcePayload.reporterName ?? null,
      visibility: sourcePayload.visibility ?? 'team_private',
      band: sourcePayload.band ?? '5GHz',
      channel: sourcePayload.channel ?? 0,
      channelWidthMHz: sourcePayload.channelWidthMHz ?? null,
      symptom: sourcePayload.symptom,
      severity: sourcePayload.severity,
      avgPingMs: sourcePayload.avgPingMs ?? null,
      maxPingMs: null,
      packetLossPercent: null,
      distanceCategory: sourcePayload.distanceCategory ?? null,
      estimatedDistanceMeters: null,
      locationLabel: sourcePayload.locationLabel ?? null,
      reproducibility: sourcePayload.reproducibility ?? null,
      description: sourcePayload.description ?? null,
      mitigationTried: null,
      improved: null,
      apDeviceModel: sourcePayload.apDeviceModel ?? null,
      clientDeviceModel: sourcePayload.clientDeviceModel ?? null,
      createdAt: localRecord?.createdAt ?? new Date().toISOString(),
      updatedAt: localRecord?.updatedAt ?? new Date().toISOString(),
    } satisfies IssueReportView;
  }, [issueReportId, localRecord, resolvedReport, sourcePayload]);

  if (issueReportQuery.isLoading || localSyncQuery.isLoading) {
    return (
      <Stack align='center' py='xl'>
        <Loader color='teal' />
        <Text c='dimmed'>報告詳細を読み込んでいます</Text>
      </Stack>
    );
  }

  if (!displayReport) {
    return (
      <Alert color='red' title='報告詳細を取得できませんでした'>
        権限不足、または対象レコードが存在しない可能性があります。
      </Alert>
    );
  }

  const handleSave = async () => {
    setSubmitError(null);

    try {
      if (localRecord) {
        await updateIssueReportSyncPayload(localRecord.id, buildIssueReportPatch(values));
      } else {
        await updateIssueReportMutation.mutateAsync(buildIssueReportPatch(values));
      }

      notifications.show({
        color: 'teal',
        title: '報告を更新しました',
        message: localRecord ? 'ローカル保存内容を更新しました。' : '追記内容を保存しました。',
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '報告の更新に失敗しました');
    }
  };

  const handleResend = async () => {
    if (!localRecord) {
      return;
    }

    setSubmitError(null);
    await updateSyncRecordAfterAttempt(localRecord.id, {
      status: 'processing',
    });

    try {
      const patch = buildIssueReportPatch(values);
      const created = await apiClient.createIssueReport(tournamentId, {
        ...buildCreatePayloadForResend(localRecord.payload, patch),
      });

      await updateSyncRecordAfterAttempt(localRecord.id, {
        status: 'done',
        entityId: created.id,
      });

      notifications.show({
        color: 'teal',
        title: '再送しました',
        message: '同期状態を更新しました。',
      });

      await navigate({ to: `/tournaments/${tournamentId}/issue-reports/${created.id}` });
    } catch (error) {
      await updateSyncRecordAfterAttempt(localRecord.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'failed to resend',
      });
      setSubmitError(error instanceof Error ? error.message : '再送に失敗しました');
    }
  };

  return (
    <Card className='form-card' padding='xl' radius='xl'>
      <Stack gap='lg'>
        <Group justify='space-between' align='flex-start'>
          <div>
            <Title order={2}>不具合報告詳細</Title>
            <Text c='dimmed'>同期状態、公開範囲、追記内容をここで確認・更新します。</Text>
          </div>
          <Button
            component={Link}
            to={`/tournaments/${tournamentId}/teams/${effectiveTeamId}`}
            variant='subtle'
          >
            チーム詳細へ戻る
          </Button>
        </Group>

        {submitError ? (
          <Alert color='red' variant='light'>
            {submitError}
          </Alert>
        ) : null}

        <Group>
          <Text fw={700}>同期状態</Text>
          <Badge color={syncBadgeColor} variant='light'>
            {syncStatus}
          </Badge>
          <Text fw={700}>公開範囲</Text>
          <Badge variant='light'>{displayReport.visibility}</Badge>
        </Group>

        <Group grow align='flex-start'>
          <TextInput label='症状' value={displayReport.symptom} readOnly />
          <TextInput label='深刻度' value={displayReport.severity} readOnly />
        </Group>

        <Group grow align='flex-start'>
          <TextInput label='帯域' value={displayReport.band} readOnly />
          <TextInput label='チャンネル' value={String(displayReport.channel)} readOnly />
          <TextInput
            label='帯域幅 (MHz)'
            value={displayReport.channelWidthMHz ? String(displayReport.channelWidthMHz) : ''}
            readOnly
          />
        </Group>

        <Group grow align='flex-start'>
          <NativeSelect
            label='公開範囲'
            value={values.visibility}
            disabled={!canEdit}
            data={ISSUE_REPORT_VISIBILITIES.map((value) => ({ value, label: value }))}
            onChange={(event) => {
              const visibility = event.currentTarget.value as DetailFormValues['visibility'];
              setValues((current) => ({
                ...current,
                visibility,
              }));
            }}
          />
          <TextInput
            label='報告者名'
            value={values.reporterName}
            disabled={!canEdit}
            onChange={(event) => {
              const reporterName = event.currentTarget.value;
              setValues((current) => ({
                ...current,
                reporterName,
              }));
            }}
          />
        </Group>

        <Group grow align='flex-start'>
          <NumberInput
            label='平均 Ping (ms)'
            value={values.avgPingMs}
            disabled={!canEdit}
            min={0}
            onChange={(value) => {
              setValues((current) => ({
                ...current,
                avgPingMs: typeof value === 'number' ? value : '',
              }));
            }}
          />
          <NativeSelect
            label='再現性'
            disabled={!canEdit}
            value={values.reproducibility}
            data={[
              { value: '', label: '未選択' },
              ...REPRODUCIBILITIES.map((value) => ({ value, label: value })),
            ]}
            onChange={(event) => {
              const reproducibility = event.currentTarget
                .value as DetailFormValues['reproducibility'];
              setValues((current) => ({
                ...current,
                reproducibility,
              }));
            }}
          />
        </Group>

        <TextInput
          label='場所ラベル'
          value={values.locationLabel}
          disabled={!canEdit}
          onChange={(event) => {
            const locationLabel = event.currentTarget.value;
            setValues((current) => ({
              ...current,
              locationLabel,
            }));
          }}
        />

        <Textarea
          label='追記メモ'
          minRows={5}
          value={values.description}
          disabled={!canEdit}
          onChange={(event) => {
            const description = event.currentTarget.value;
            setValues((current) => ({
              ...current,
              description,
            }));
          }}
        />

        <Group justify='flex-end'>
          {localRecord ? (
            <Button color='orange' variant='light' onClick={() => void handleResend()}>
              再送
            </Button>
          ) : null}
          {canEdit ? (
            <Button loading={updateIssueReportMutation.isPending} onClick={() => void handleSave()}>
              追記を保存
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Card>
  );
}
