import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
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
import {
  DISTANCE_CATEGORIES,
  ISSUE_REPORT_VISIBILITIES,
  MITIGATIONS,
  REPRODUCIBILITIES,
} from '@wifiman/shared';
import { useEffect, useMemo, useState } from 'react';
import {
  apiClient,
  type IssueReportCreateInput,
  type IssueReportView,
} from '../lib/api/client.js';
import { canEditTeamResources } from '../lib/authz.js';
import {
  findIssueReportSyncRecord,
  updateIssueReportSyncPayload,
  updateSyncRecordAfterAttempt,
} from '../lib/db/appDb.js';
import {
  buildIssueReportPatchFormValues,
  createEmptyIssueReportAttachment,
  issueReportPatchFormSchema,
  toIssueReportPatchInput,
  type IssueReportPatchFormValues,
} from '../lib/issueReportForm.js';
import { getSubmitErrorMessage } from '../lib/tanstackFormZod.js';
import { useAuthSession } from '../lib/useAuthSession.js';
import { useIssueReport, useUpdateIssueReportMutation } from '../lib/useTeamManagement.js';

type IssueReportDetailPageProps = {
  tournamentId: string;
  issueReportId: string;
};

function buildCreatePayloadForResend(
  payload: IssueReportCreateInput,
  patch: ReturnType<typeof toIssueReportPatchInput>,
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
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof IssueReportPatchFormValues, string>>
  >({});
  const [values, setValues] = useState<IssueReportPatchFormValues>(() =>
    buildIssueReportPatchFormValues(null, localRecord?.payload),
  );

  useEffect(() => {
    setValues(buildIssueReportPatchFormValues(resolvedReport, localRecord?.payload));
    setFieldErrors({});
  }, [localRecord?.payload, resolvedReport]);

  const clearMessageForField = (fieldName?: keyof IssueReportPatchFormValues) => {
    setSubmitError(null);

    if (!fieldName) {
      return;
    }

    setFieldErrors((current) => {
      if (!(fieldName in current)) {
        return current;
      }

      const next = { ...current };
      delete next[fieldName];
      return next;
    });
  };

  const updateFieldValue = <TName extends keyof IssueReportPatchFormValues>(
    fieldName: TName,
    nextValue: IssueReportPatchFormValues[TName],
  ) => {
    clearMessageForField(fieldName);
    setValues((current) => ({
      ...current,
      [fieldName]: nextValue,
    }));
  };

  const validateValues = () => {
    const parsed = issueReportPatchFormSchema.safeParse(values);

    if (parsed.success) {
      setFieldErrors({});
      return true;
    }

    const nextFieldErrors: Partial<Record<keyof IssueReportPatchFormValues, string>> = {};

    for (const issue of parsed.error.issues) {
      const fieldName = issue.path[0];
      if (typeof fieldName !== 'string') {
        continue;
      }

      const typedFieldName = fieldName as keyof IssueReportPatchFormValues;
      if (nextFieldErrors[typedFieldName]) {
        continue;
      }

      nextFieldErrors[typedFieldName] = issue.message;
    }

    setFieldErrors(nextFieldErrors);
    setSubmitError(null);
    return false;
  };

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
      maxPingMs: sourcePayload.maxPingMs ?? null,
      packetLossPercent: sourcePayload.packetLossPercent ?? null,
      distanceCategory: sourcePayload.distanceCategory ?? null,
      estimatedDistanceMeters: sourcePayload.estimatedDistanceMeters ?? null,
      locationLabel: sourcePayload.locationLabel ?? null,
      reproducibility: sourcePayload.reproducibility ?? null,
      description: sourcePayload.description ?? null,
      mitigationTried: sourcePayload.mitigationTried ?? null,
      improved: sourcePayload.improved ?? null,
      attachments: sourcePayload.attachments ?? null,
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

    if (!validateValues()) {
      return;
    }

    const patch = toIssueReportPatchInput(values);

    try {
      if (localRecord) {
        await updateIssueReportSyncPayload(localRecord.id, patch);
      } else {
        await updateIssueReportMutation.mutateAsync(patch);
      }

      notifications.show({
        color: 'teal',
        title: '報告を更新しました',
        message: localRecord ? 'ローカル保存内容を更新しました。' : '追記内容を保存しました。',
      });
    } catch (error) {
      setSubmitError(getSubmitErrorMessage(error, '報告の更新に失敗しました'));
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
      const patch = toIssueReportPatchInput(values);
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
        errorMessage: getSubmitErrorMessage(error, 'failed to resend'),
      });
      setSubmitError(getSubmitErrorMessage(error, '再送に失敗しました'));
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
            error={fieldErrors.visibility}
            disabled={!canEdit}
            data={ISSUE_REPORT_VISIBILITIES.map((value) => ({ value, label: value }))}
            onChange={(event) => {
              updateFieldValue('visibility', event.currentTarget.value);
            }}
          />
          <TextInput
            label='報告者名'
            value={values.reporterName}
            error={fieldErrors.reporterName}
            disabled={!canEdit}
            onChange={(event) => {
              updateFieldValue('reporterName', event.currentTarget.value);
            }}
          />
        </Group>

        <Group grow align='flex-start'>
          <NumberInput
            label='平均 Ping (ms)'
            value={values.avgPingMs}
            error={fieldErrors.avgPingMs}
            disabled={!canEdit}
            min={0}
            onChange={(value) => {
              updateFieldValue('avgPingMs', typeof value === 'number' ? value : '');
            }}
          />
          <NumberInput
            label='最大 Ping (ms)'
            value={values.maxPingMs}
            error={fieldErrors.maxPingMs}
            disabled={!canEdit}
            min={0}
            onChange={(value) => {
              updateFieldValue('maxPingMs', typeof value === 'number' ? value : '');
            }}
          />
          <NumberInput
            label='パケットロス率 (%)'
            value={values.packetLossPercent}
            error={fieldErrors.packetLossPercent}
            disabled={!canEdit}
            min={0}
            max={100}
            onChange={(value) => {
              updateFieldValue('packetLossPercent', typeof value === 'number' ? value : '');
            }}
          />
        </Group>

        <Group grow align='flex-start'>
          <NativeSelect
            label='距離カテゴリ'
            disabled={!canEdit}
            value={values.distanceCategory}
            error={fieldErrors.distanceCategory}
            data={[
              { value: '', label: '未選択' },
              ...DISTANCE_CATEGORIES.map((value) => ({ value, label: value })),
            ]}
            onChange={(event) => {
              updateFieldValue('distanceCategory', event.currentTarget.value);
            }}
          />
          <NumberInput
            label='推定距離[m]'
            value={values.estimatedDistanceMeters}
            error={fieldErrors.estimatedDistanceMeters}
            disabled={!canEdit}
            min={0}
            onChange={(value) => {
              updateFieldValue('estimatedDistanceMeters', typeof value === 'number' ? value : '');
            }}
          />
          <NativeSelect
            label='再現性'
            disabled={!canEdit}
            value={values.reproducibility}
            error={fieldErrors.reproducibility}
            data={[
              { value: '', label: '未選択' },
              ...REPRODUCIBILITIES.map((value) => ({ value, label: value })),
            ]}
            onChange={(event) => {
              updateFieldValue('reproducibility', event.currentTarget.value);
            }}
          />
        </Group>

        <TextInput
          label='観測位置'
          value={values.locationLabel}
          error={fieldErrors.locationLabel}
          disabled={!canEdit}
          onChange={(event) => {
            updateFieldValue('locationLabel', event.currentTarget.value);
          }}
        />

        <Checkbox.Group
          label='対処内容'
          value={values.mitigationTried}
          onChange={(mitigationTried) => {
            updateFieldValue('mitigationTried', mitigationTried);
          }}
        >
          <Group mt='xs'>
            {MITIGATIONS.map((value) => (
              <Checkbox key={value} value={value} label={value} disabled={!canEdit} />
            ))}
          </Group>
        </Checkbox.Group>

        <NativeSelect
          label='改善有無'
          disabled={!canEdit}
          value={values.improved}
          error={fieldErrors.improved}
          data={[
            { value: '', label: '未選択' },
            { value: 'true', label: '改善した' },
            { value: 'false', label: '改善しない' },
          ]}
          onChange={(event) => {
            updateFieldValue('improved', event.currentTarget.value as IssueReportPatchFormValues['improved']);
          }}
        />

        <Stack gap='sm'>
          <Group justify='space-between'>
            <Text fw={700}>添付ファイル</Text>
            {canEdit ? (
              <Button
                variant='light'
                size='xs'
                onClick={() => {
                  clearMessageForField('attachments');
                  setValues((current) => ({
                    ...current,
                    attachments: [...current.attachments, createEmptyIssueReportAttachment()],
                  }));
                }}
              >
                添付を追加
              </Button>
            ) : null}
          </Group>

          {values.attachments.map((attachment, index) => (
            <Card key={attachment.id} withBorder radius='md' padding='md'>
              <Stack gap='sm'>
                <Group grow align='flex-start'>
                  <TextInput
                    label={`添付ファイル名 ${index + 1}`}
                    value={attachment.name}
                    error={fieldErrors.attachments}
                    disabled={!canEdit}
                    onChange={(event) => {
                      const name = event.currentTarget.value;
                      clearMessageForField('attachments');
                      setValues((current) => ({
                        ...current,
                        attachments: current.attachments.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, name } : entry,
                        ),
                      }));
                    }}
                  />
                  <TextInput
                    label={`参照 URL ${index + 1}`}
                    value={attachment.url}
                    disabled={!canEdit}
                    onChange={(event) => {
                      const url = event.currentTarget.value;
                      clearMessageForField('attachments');
                      setValues((current) => ({
                        ...current,
                        attachments: current.attachments.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, url } : entry,
                        ),
                      }));
                    }}
                  />
                </Group>
                <Group grow align='flex-start'>
                  <TextInput
                    label={`MIME type ${index + 1}`}
                    value={attachment.mimeType}
                    disabled={!canEdit}
                    onChange={(event) => {
                      const mimeType = event.currentTarget.value;
                      clearMessageForField('attachments');
                      setValues((current) => ({
                        ...current,
                        attachments: current.attachments.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, mimeType } : entry,
                        ),
                      }));
                    }}
                  />
                  <NumberInput
                    label={`サイズ (bytes) ${index + 1}`}
                    value={attachment.sizeBytes}
                    disabled={!canEdit}
                    min={0}
                    onChange={(value) => {
                      clearMessageForField('attachments');
                      setValues((current) => ({
                        ...current,
                        attachments: current.attachments.map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, sizeBytes: typeof value === 'number' ? value : '' }
                            : entry,
                        ),
                      }));
                    }}
                  />
                </Group>
                {canEdit ? (
                  <Group justify='flex-end'>
                    <Button
                      color='red'
                      variant='subtle'
                      size='xs'
                      onClick={() => {
                        clearMessageForField('attachments');
                        setValues((current) => ({
                          ...current,
                          attachments: current.attachments.filter(
                            (_, entryIndex) => entryIndex !== index,
                          ),
                        }));
                      }}
                    >
                      添付を削除
                    </Button>
                  </Group>
                ) : null}
              </Stack>
            </Card>
          ))}
        </Stack>

        <Textarea
          label='自由記述'
          minRows={5}
          value={values.description}
          error={fieldErrors.description}
          disabled={!canEdit}
          onChange={(event) => {
            updateFieldValue('description', event.currentTarget.value);
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
