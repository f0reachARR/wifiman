import {
  Alert,
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
import { Link, useNavigate } from '@tanstack/react-router';
import {
  DISTANCE_CATEGORIES,
  ISSUE_REPORT_VISIBILITIES,
  SEVERITIES,
  SYMPTOMS,
} from '@wifiman/shared';
import { useEffect, useMemo, useState } from 'react';
import type { IssueReportCreateInput } from '../lib/api/client.js';
import { canEditTeamResources } from '../lib/authz.js';
import { useAuthSession } from '../lib/useAuthSession.js';
import { useCreateIssueReportMutation, useTeamWifiConfigs } from '../lib/useTeamManagement.js';

type IssueReportCreatePageProps = {
  tournamentId: string;
};

type FormValues = {
  wifiConfigId: string;
  reporterName: string;
  visibility: NonNullable<IssueReportCreateInput['visibility']>;
  symptom: '' | IssueReportCreateInput['symptom'];
  severity: '' | IssueReportCreateInput['severity'];
  avgPingMs: number | '';
  distanceCategory: '' | NonNullable<IssueReportCreateInput['distanceCategory']>;
  description: string;
};

function getInitialWifiConfigId() {
  if (typeof window === 'undefined') {
    return '';
  }

  return new URLSearchParams(window.location.search).get('wifiConfigId') ?? '';
}

export function IssueReportCreatePage({ tournamentId }: IssueReportCreatePageProps) {
  const navigate = useNavigate();
  const { data: session, isLoading: isSessionLoading } = useAuthSession();
  const teamId =
    session?.kind === 'team' && session.tournamentId === tournamentId ? session.teamId : '';
  const wifiConfigsQuery = useTeamWifiConfigs(teamId);
  const createIssueReportMutation = useCreateIssueReportMutation(tournamentId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>({
    wifiConfigId: getInitialWifiConfigId(),
    reporterName: '',
    visibility: 'team_private',
    symptom: '',
    severity: '',
    avgPingMs: '',
    distanceCategory: '',
    description: '',
  });

  const canCreate = Boolean(teamId && canEditTeamResources(session, teamId));
  const wifiConfigs = wifiConfigsQuery.data ?? [];

  useEffect(() => {
    if (wifiConfigs.length === 0) {
      return;
    }

    setValues((current) => {
      if (
        current.wifiConfigId &&
        wifiConfigs.some((config) => config.id === current.wifiConfigId)
      ) {
        return current;
      }

      return {
        ...current,
        wifiConfigId: wifiConfigs[0]?.id ?? '',
      };
    });
  }, [wifiConfigs]);

  const selectedConfig = useMemo(
    () => wifiConfigs.find((config) => config.id === values.wifiConfigId) ?? null,
    [values.wifiConfigId, wifiConfigs],
  );

  if (isSessionLoading || (canCreate && wifiConfigsQuery.isLoading)) {
    return (
      <Stack align='center' py='xl'>
        <Loader color='teal' />
        <Text c='dimmed'>報告作成画面を準備しています</Text>
      </Stack>
    );
  }

  if (!teamId || !canCreate) {
    return (
      <Alert color='red' title='報告作成権限がありません'>
        自チームの編集セッションでアクセスしてください。
      </Alert>
    );
  }

  if (wifiConfigsQuery.isError) {
    return (
      <Alert color='red' title='WiFi 構成を取得できませんでした'>
        少し時間を置いて再度お試しください。
      </Alert>
    );
  }

  if (wifiConfigs.length === 0) {
    return (
      <Alert color='orange' title='報告対象の WiFi 構成がありません'>
        先に自チームの WiFi 構成を登録してください。
      </Alert>
    );
  }

  const handleSubmit = async () => {
    setSubmitError(null);

    if (!selectedConfig) {
      setSubmitError('WiFi 構成を選択してください');
      return;
    }

    if (!values.symptom) {
      setSubmitError('症状を選択してください');
      return;
    }

    if (!values.severity) {
      setSubmitError('深刻度を選択してください');
      return;
    }

    const payload: IssueReportCreateInput = {
      teamId,
      wifiConfigId: selectedConfig.id,
      visibility: values.visibility,
      symptom: values.symptom,
      severity: values.severity,
      band: selectedConfig.band,
      channel: selectedConfig.channel,
      ...(selectedConfig.channelWidthMHz
        ? { channelWidthMHz: selectedConfig.channelWidthMHz }
        : {}),
      ...(values.reporterName.trim().length > 0
        ? { reporterName: values.reporterName.trim() }
        : {}),
      ...(values.avgPingMs !== '' ? { avgPingMs: values.avgPingMs } : {}),
      ...(values.distanceCategory ? { distanceCategory: values.distanceCategory } : {}),
      ...(values.description.trim().length > 0 ? { description: values.description.trim() } : {}),
    };

    try {
      await createIssueReportMutation.mutateAsync(payload);
      notifications.show({
        color: 'teal',
        title: '報告を保存しました',
        message: '自チーム画面で詳細を確認できます。',
      });
      await navigate({ to: `/tournaments/${tournamentId}/teams/${teamId}` });
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : '報告の保存に失敗しました');
    }
  };

  return (
    <Card className='form-card' padding='xl' radius='xl'>
      <Stack gap='lg'>
        <div>
          <Title order={2}>不具合報告を作成</Title>
          <Text c='dimmed'>
            チャンネルマップまたは自チーム画面から開始し、既存 WiFi
            構成の情報を自動補完して短時間で報告します。
          </Text>
        </div>

        {submitError ? (
          <Alert color='red' variant='light'>
            {submitError}
          </Alert>
        ) : null}

        <Stack gap='md'>
          <NativeSelect
            label='WiFi 構成'
            data={wifiConfigs.map((config) => ({ value: config.id, label: config.name }))}
            value={values.wifiConfigId}
            onChange={(event) => {
              setValues((current) => ({
                ...current,
                wifiConfigId: event.currentTarget.value,
              }));
            }}
          />

          <Group grow align='flex-start'>
            <TextInput label='構成名' value={selectedConfig?.name ?? ''} readOnly />
            <TextInput label='帯域' value={selectedConfig?.band ?? ''} readOnly />
          </Group>

          <Group grow align='flex-start'>
            <TextInput
              label='チャンネル'
              value={selectedConfig ? String(selectedConfig.channel) : ''}
              readOnly
            />
            <TextInput
              label='帯域幅 (MHz)'
              value={selectedConfig?.channelWidthMHz ? String(selectedConfig.channelWidthMHz) : ''}
              readOnly
            />
          </Group>

          <Group grow align='flex-start'>
            <NativeSelect
              label='公開範囲'
              data={ISSUE_REPORT_VISIBILITIES.map((value) => ({ value, label: value }))}
              value={values.visibility}
              onChange={(event) => {
                setValues((current) => ({
                  ...current,
                  visibility: event.currentTarget.value as NonNullable<
                    IssueReportCreateInput['visibility']
                  >,
                }));
              }}
            />
            <TextInput
              label='報告者名'
              placeholder='任意'
              value={values.reporterName}
              onChange={(event) => {
                setValues((current) => ({
                  ...current,
                  reporterName: event.currentTarget.value,
                }));
              }}
            />
          </Group>

          <Group grow align='flex-start'>
            <NativeSelect
              label='症状'
              data={[
                { value: '', label: '選択してください' },
                ...SYMPTOMS.map((value) => ({ value, label: value })),
              ]}
              value={values.symptom}
              onChange={(event) => {
                setValues((current) => ({
                  ...current,
                  symptom: event.currentTarget.value as FormValues['symptom'],
                }));
              }}
            />
            <NativeSelect
              label='深刻度'
              data={[
                { value: '', label: '選択してください' },
                ...SEVERITIES.map((value) => ({ value, label: value })),
              ]}
              value={values.severity}
              onChange={(event) => {
                setValues((current) => ({
                  ...current,
                  severity: event.currentTarget.value as FormValues['severity'],
                }));
              }}
            />
          </Group>

          <Group grow align='flex-start'>
            <NumberInput
              label='平均 Ping (ms)'
              placeholder='任意'
              min={0}
              value={values.avgPingMs}
              onChange={(value) => {
                setValues((current) => ({
                  ...current,
                  avgPingMs: typeof value === 'number' ? value : '',
                }));
              }}
            />
            <NativeSelect
              label='距離カテゴリ'
              data={[
                { value: '', label: '未選択' },
                ...DISTANCE_CATEGORIES.map((value) => ({ value, label: value })),
              ]}
              value={values.distanceCategory}
              onChange={(event) => {
                setValues((current) => ({
                  ...current,
                  distanceCategory: event.currentTarget.value as FormValues['distanceCategory'],
                }));
              }}
            />
          </Group>

          <Textarea
            label='一言メモ'
            placeholder='任意'
            minRows={4}
            value={values.description}
            onChange={(event) => {
              setValues((current) => ({
                ...current,
                description: event.currentTarget.value,
              }));
            }}
          />
        </Stack>

        <Group justify='space-between'>
          <Button component={Link} to={`/tournaments/${tournamentId}/channel-map`} variant='subtle'>
            チャンネルマップへ戻る
          </Button>
          <Button loading={createIssueReportMutation.isPending} onClick={() => void handleSubmit()}>
            報告を保存
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
