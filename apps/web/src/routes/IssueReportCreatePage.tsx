import {
  Alert,
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
import { Link, useNavigate } from '@tanstack/react-router';
import {
  DISTANCE_CATEGORIES,
  ISSUE_REPORT_VISIBILITIES,
  MITIGATIONS,
  REPRODUCIBILITIES,
  SEVERITIES,
  SYMPTOMS,
} from '@wifiman/shared';
import { useEffect, useMemo, useState } from 'react';
import type { IssueReportCreateInput } from '../lib/api/client.js';
import { canEditTeamResources } from '../lib/authz.js';
import { queueIssueReportSync } from '../lib/db/appDb.js';
import { useAuthSession } from '../lib/useAuthSession.js';
import {
  useCreateIssueReportMutation,
  useTeam,
  useTeamDeviceSpecs,
  useTeamWifiConfigs,
} from '../lib/useTeamManagement.js';

type IssueReportCreatePageProps = {
  tournamentId: string;
};

type IssueReportCreateAttachment = NonNullable<
  NonNullable<IssueReportCreateInput['attachments']>[number]
>;

type FormValues = {
  wifiConfigId: string;
  reporterName: string;
  visibility: NonNullable<IssueReportCreateInput['visibility']>;
  symptom: '' | IssueReportCreateInput['symptom'];
  severity: '' | IssueReportCreateInput['severity'];
  avgPingMs: number | '';
  packetLossPercent: number | '';
  distanceCategory: '' | NonNullable<IssueReportCreateInput['distanceCategory']>;
  maxPingMs: number | '';
  estimatedDistanceMeters: number | '';
  reproducibility: '' | NonNullable<IssueReportCreateInput['reproducibility']>;
  locationLabel: string;
  mitigationTried: NonNullable<IssueReportCreateInput['mitigationTried']>;
  improved: '' | 'true' | 'false';
  description: string;
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    mimeType: string;
    sizeBytes: number | '';
  }>;
};

type AttachmentDraft = FormValues['attachments'][number];

function createEmptyAttachment(): AttachmentDraft {
  return {
    id: crypto.randomUUID(),
    name: '',
    url: '',
    mimeType: '',
    sizeBytes: '',
  };
}

function sanitizeAttachments(drafts: AttachmentDraft[]): IssueReportCreateAttachment[] {
  return drafts.flatMap((draft) => {
    const name = draft.name.trim();
    const url = draft.url.trim();
    const mimeType = draft.mimeType.trim();

    if (name.length === 0 && url.length === 0 && mimeType.length === 0 && draft.sizeBytes === '') {
      return [];
    }

    if (name.length === 0) {
      return [];
    }

    const attachment: IssueReportCreateAttachment = { name };

    if (url.length > 0) {
      attachment.url = url;
    }
    if (mimeType.length > 0) {
      attachment.mimeType = mimeType;
    }
    if (draft.sizeBytes !== '') {
      attachment.sizeBytes = draft.sizeBytes;
    }

    return [attachment];
  });
}

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
  const teamQuery = useTeam(teamId);
  const wifiConfigsQuery = useTeamWifiConfigs(teamId);
  const deviceSpecsQuery = useTeamDeviceSpecs(teamId, false);
  const createIssueReportMutation = useCreateIssueReportMutation(tournamentId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [isDetailedMode, setIsDetailedMode] = useState(false);
  const [values, setValues] = useState<FormValues>({
    wifiConfigId: getInitialWifiConfigId(),
    reporterName: '',
    visibility: 'team_private',
    symptom: '',
    severity: '',
    avgPingMs: '',
    packetLossPercent: '',
    distanceCategory: '',
    maxPingMs: '',
    estimatedDistanceMeters: '',
    reproducibility: '',
    locationLabel: '',
    mitigationTried: [],
    improved: '',
    description: '',
    attachments: [],
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
  const selectedApModel = useMemo(() => {
    if (!selectedConfig || !('apDeviceId' in selectedConfig) || !selectedConfig.apDeviceId) {
      return '';
    }

    return (
      (deviceSpecsQuery.data ?? []).find((spec) => spec.id === selectedConfig.apDeviceId)?.model ??
      ''
    );
  }, [deviceSpecsQuery.data, selectedConfig]);
  const selectedClientModel = useMemo(() => {
    if (
      !selectedConfig ||
      !('clientDeviceId' in selectedConfig) ||
      !selectedConfig.clientDeviceId
    ) {
      return '';
    }

    return (
      (deviceSpecsQuery.data ?? []).find((spec) => spec.id === selectedConfig.clientDeviceId)
        ?.model ?? ''
    );
  }, [deviceSpecsQuery.data, selectedConfig]);

  if (isSessionLoading || (canCreate && (teamQuery.isLoading || wifiConfigsQuery.isLoading))) {
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
    setOfflineMessage(null);

    const payload = buildPayload();

    if (!payload) {
      return;
    }

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

  const buildPayload = (): IssueReportCreateInput | null => {
    if (!selectedConfig) {
      setSubmitError('WiFi 構成を選択してください');
      return null;
    }

    if (!values.symptom) {
      setSubmitError('症状を選択してください');
      return null;
    }

    if (!values.severity) {
      setSubmitError('深刻度を選択してください');
      return null;
    }

    return {
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
      ...(values.packetLossPercent !== '' ? { packetLossPercent: values.packetLossPercent } : {}),
      ...(values.distanceCategory ? { distanceCategory: values.distanceCategory } : {}),
      ...(values.maxPingMs !== '' ? { maxPingMs: values.maxPingMs } : {}),
      ...(values.estimatedDistanceMeters !== ''
        ? { estimatedDistanceMeters: values.estimatedDistanceMeters }
        : {}),
      ...(values.reproducibility ? { reproducibility: values.reproducibility } : {}),
      ...(values.locationLabel.trim().length > 0
        ? { locationLabel: values.locationLabel.trim() }
        : {}),
      ...(values.mitigationTried.length > 0 ? { mitigationTried: values.mitigationTried } : {}),
      ...(values.improved === 'true' ? { improved: true } : {}),
      ...(values.improved === 'false' ? { improved: false } : {}),
      ...(values.description.trim().length > 0 ? { description: values.description.trim() } : {}),
      ...(sanitizeAttachments(values.attachments).length > 0
        ? { attachments: sanitizeAttachments(values.attachments) }
        : {}),
      ...(selectedApModel ? { apDeviceModel: selectedApModel } : {}),
      ...(selectedClientModel ? { clientDeviceModel: selectedClientModel } : {}),
    };
  };

  const handleOfflineSave = async () => {
    setSubmitError(null);
    setOfflineMessage(null);

    const payload = buildPayload();

    if (!payload) {
      return;
    }

    try {
      await queueIssueReportSync(tournamentId, payload);
      setOfflineMessage('オフライン保存しました');
      notifications.show({
        color: 'orange',
        title: 'オフライン保存しました',
        message: '接続回復後に報告詳細から再送できます。',
      });
    } catch {
      setSubmitError('オフライン保存に失敗しました');
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
        {offlineMessage ? (
          <Alert color='orange' variant='light'>
            {offlineMessage}
          </Alert>
        ) : null}

        <Stack gap='md'>
          <TextInput label='チーム' value={teamQuery.data?.name ?? ''} readOnly />

          <NativeSelect
            label='WiFi 構成'
            data={wifiConfigs.map((config) => ({ value: config.id, label: config.name }))}
            value={values.wifiConfigId}
            onChange={(event) => {
              const wifiConfigId = event.currentTarget.value;
              setValues((current) => ({
                ...current,
                wifiConfigId,
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
            <TextInput label='AP 型番' value={selectedApModel} readOnly />
            <TextInput label='Client 型番' value={selectedClientModel} readOnly />
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
                const symptom = event.currentTarget.value as FormValues['symptom'];
                setValues((current) => ({
                  ...current,
                  symptom,
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
                const severity = event.currentTarget.value as FormValues['severity'];
                setValues((current) => ({
                  ...current,
                  severity,
                }));
              }}
            />
          </Group>

          <Group grow align='flex-start'>
            <NativeSelect
              label='公開範囲'
              data={ISSUE_REPORT_VISIBILITIES.map((value) => ({ value, label: value }))}
              value={values.visibility}
              onChange={(event) => {
                const visibility = event.currentTarget.value as NonNullable<
                  IssueReportCreateInput['visibility']
                >;
                setValues((current) => ({
                  ...current,
                  visibility,
                }));
              }}
            />
            <TextInput
              label='報告者名'
              placeholder='任意'
              value={values.reporterName}
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
            <NumberInput
              label='パケットロス率 (%)'
              placeholder='任意'
              min={0}
              max={100}
              value={values.packetLossPercent}
              onChange={(value) => {
                setValues((current) => ({
                  ...current,
                  packetLossPercent: typeof value === 'number' ? value : '',
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
                const distanceCategory = event.currentTarget
                  .value as FormValues['distanceCategory'];
                setValues((current) => ({
                  ...current,
                  distanceCategory,
                }));
              }}
            />
          </Group>

          <Textarea
            label={isDetailedMode ? '自由記述' : '一言メモ'}
            placeholder='任意'
            minRows={isDetailedMode ? 5 : 3}
            value={values.description}
            onChange={(event) => {
              const description = event.currentTarget.value;
              setValues((current) => ({
                ...current,
                description,
              }));
            }}
          />

          <Group justify='space-between'>
            <Text fw={700}>{isDetailedMode ? '詳細モード' : '簡易モード'}</Text>
            <Button
              variant='subtle'
              onClick={() => {
                setIsDetailedMode((current) => !current);
              }}
            >
              {isDetailedMode ? '簡易モードに戻す' : '詳細モードを開く'}
            </Button>
          </Group>

          {isDetailedMode ? (
            <Stack gap='md'>
              <Group grow align='flex-start'>
                <NumberInput
                  label='最大 Ping (ms)'
                  placeholder='任意'
                  min={0}
                  value={values.maxPingMs}
                  onChange={(value) => {
                    setValues((current) => ({
                      ...current,
                      maxPingMs: typeof value === 'number' ? value : '',
                    }));
                  }}
                />
                <NumberInput
                  label='推定距離[m]'
                  placeholder='任意'
                  min={0}
                  value={values.estimatedDistanceMeters}
                  onChange={(value) => {
                    setValues((current) => ({
                      ...current,
                      estimatedDistanceMeters: typeof value === 'number' ? value : '',
                    }));
                  }}
                />
              </Group>

              <Group grow align='flex-start'>
                <NativeSelect
                  label='再現性'
                  data={[
                    { value: '', label: '未選択' },
                    ...REPRODUCIBILITIES.map((value) => ({ value, label: value })),
                  ]}
                  value={values.reproducibility}
                  onChange={(event) => {
                    const reproducibility = event.currentTarget
                      .value as FormValues['reproducibility'];
                    setValues((current) => ({
                      ...current,
                      reproducibility,
                    }));
                  }}
                />
                <NativeSelect
                  label='改善有無'
                  data={[
                    { value: '', label: '未選択' },
                    { value: 'true', label: '改善した' },
                    { value: 'false', label: '改善しない' },
                  ]}
                  value={values.improved}
                  onChange={(event) => {
                    const improved = event.currentTarget.value as FormValues['improved'];
                    setValues((current) => ({
                      ...current,
                      improved,
                    }));
                  }}
                />
              </Group>

              <TextInput
                label='観測位置'
                placeholder='任意'
                value={values.locationLabel}
                onChange={(event) => {
                  const locationLabel = event.currentTarget.value;
                  setValues((current) => ({
                    ...current,
                    locationLabel,
                  }));
                }}
              />

              <Checkbox.Group
                label='対処内容'
                value={values.mitigationTried}
                onChange={(mitigationTried) => {
                  setValues((current) => ({
                    ...current,
                    mitigationTried: mitigationTried as FormValues['mitigationTried'],
                  }));
                }}
              >
                <Group mt='xs'>
                  {MITIGATIONS.map((value) => (
                    <Checkbox key={value} value={value} label={value} />
                  ))}
                </Group>
              </Checkbox.Group>

              <Stack gap='sm'>
                <Group justify='space-between'>
                  <Text fw={600}>添付ファイル</Text>
                  <Button
                    variant='light'
                    size='xs'
                    onClick={() => {
                      setValues((current) => ({
                        ...current,
                        attachments: [...current.attachments, createEmptyAttachment()],
                      }));
                    }}
                  >
                    添付を追加
                  </Button>
                </Group>

                {values.attachments.map((attachment, index) => (
                  <Card key={attachment.id} withBorder radius='md' padding='md'>
                    <Stack gap='sm'>
                      <Group grow align='flex-start'>
                        <TextInput
                          label={`添付ファイル名 ${index + 1}`}
                          value={attachment.name}
                          onChange={(event) => {
                            const name = event.currentTarget.value;
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
                          onChange={(event) => {
                            const url = event.currentTarget.value;
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
                          onChange={(event) => {
                            const mimeType = event.currentTarget.value;
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
                          min={0}
                          value={attachment.sizeBytes}
                          onChange={(value) => {
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
                      <Group justify='flex-end'>
                        <Button
                          color='red'
                          variant='subtle'
                          size='xs'
                          onClick={() => {
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
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Stack>
          ) : null}
        </Stack>

        <Group justify='space-between'>
          <Button component={Link} to={`/tournaments/${tournamentId}/channel-map`} variant='subtle'>
            チャンネルマップへ戻る
          </Button>
          <Group>
            <Button variant='light' color='orange' onClick={() => void handleOfflineSave()}>
              オフライン保存
            </Button>
            <Button
              loading={createIssueReportMutation.isPending}
              onClick={() => void handleSubmit()}
            >
              報告を保存
            </Button>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}
