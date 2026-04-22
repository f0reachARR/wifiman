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
import { useForm } from '@tanstack/react-form';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  DISTANCE_CATEGORIES,
  ISSUE_REPORT_VISIBILITIES,
  MITIGATIONS,
  REPRODUCIBILITIES,
  SEVERITIES,
  SYMPTOMS,
} from '@wifiman/shared';
import { useEffect, useRef, useState } from 'react';
import { canEditTeamResources } from '../lib/authz.js';
import { queueIssueReportSync } from '../lib/db/appDb.js';
import {
  buildIssueReportCreateFormValues,
  createEmptyIssueReportAttachment,
  issueReportCreateFormSchema,
  toIssueReportCreatePayload,
} from '../lib/issueReportForm.js';
import { createTanStackFormZodHelpers } from '../lib/tanstackFormZod.js';
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
  const submitModeRef = useRef<'create' | 'offline'>('create');
  const canCreate = Boolean(teamId && canEditTeamResources(session, teamId));
  const wifiConfigs = wifiConfigsQuery.data ?? [];
  const zodFormHelpers = createTanStackFormZodHelpers(issueReportCreateFormSchema, setSubmitError);

  const clearMessages = () => {
    setSubmitError(null);
    setOfflineMessage(null);
  };

  const getSelectedConfig = (wifiConfigId: string) =>
    wifiConfigs.find((config) => config.id === wifiConfigId) ?? null;

  const getSelectedApModel = (wifiConfigId: string) => {
    const selectedConfig = getSelectedConfig(wifiConfigId);

    if (!selectedConfig || !('apDeviceId' in selectedConfig) || !selectedConfig.apDeviceId) {
      return '';
    }

    return (
      (deviceSpecsQuery.data ?? []).find((spec) => spec.id === selectedConfig.apDeviceId)?.model ??
      ''
    );
  };

  const getSelectedClientModel = (wifiConfigId: string) => {
    const selectedConfig = getSelectedConfig(wifiConfigId);

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
  };

  const form = useForm({
    defaultValues: buildIssueReportCreateFormValues(getInitialWifiConfigId()),
    onSubmit: async ({ value }) => {
      clearMessages();

      const selectedConfig = getSelectedConfig(value.wifiConfigId);
      if (!selectedConfig) {
        setSubmitError('WiFi 構成を選択してください');
        return;
      }

      const payload = toIssueReportCreatePayload(value, {
        teamId,
        selectedConfig: {
          id: selectedConfig.id,
          band: selectedConfig.band,
          channel: selectedConfig.channel,
          channelWidthMHz: selectedConfig.channelWidthMHz ?? undefined,
        },
        selectedApModel: getSelectedApModel(value.wifiConfigId),
        selectedClientModel: getSelectedClientModel(value.wifiConfigId),
      });

      if (submitModeRef.current === 'offline') {
        try {
          await queueIssueReportSync(tournamentId, payload);
          setOfflineMessage('オフライン保存しました');
          notifications.show({
            color: 'orange',
            title: 'オフライン保存しました',
            message: 'オンライン復帰後に同期画面から再送できます。',
          });
        } catch (error) {
          setSubmitError(error instanceof Error ? error.message : 'オフライン保存に失敗しました');
        }
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
        zodFormHelpers.handleSubmitError(error);
      }
    },
  });

  useEffect(() => {
    if (wifiConfigs.length === 0) {
      return;
    }

    const currentWifiConfigId = form.state.values.wifiConfigId;
    if (
      currentWifiConfigId.length > 0 &&
      wifiConfigs.some((config) => config.id === currentWifiConfigId)
    ) {
      return;
    }

    const nextWifiConfigId = wifiConfigs[0]?.id ?? '';
    if (nextWifiConfigId.length > 0) {
      form.setFieldValue('wifiConfigId', nextWifiConfigId);
    }
  }, [form, wifiConfigs]);

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

  if (teamQuery.isError) {
    return (
      <Alert color='red' title='チーム情報を取得できませんでした'>
        少し時間を置いて再度お試しください。
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

  return (
    <Card className='form-card' padding='xl' radius='xl'>
      <Stack gap='lg'>
        <div>
          <Title order={2}>不具合報告を作成</Title>
          <Text c='dimmed'>簡易モードで素早く報告し、必要に応じて詳細モードを開いてください。</Text>
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

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            clearMessages();
            void form.handleSubmit();
          }}
        >
          <form.Subscribe selector={(state) => state.values}>
            {(values) => {
              const selectedConfig = getSelectedConfig(values.wifiConfigId);
              const selectedApModel = getSelectedApModel(values.wifiConfigId);
              const selectedClientModel = getSelectedClientModel(values.wifiConfigId);
              const handleFieldChange = <T,>(handleChange: (value: T) => void, nextValue: T) => {
                clearMessages();
                handleChange(nextValue);
              };

              return (
                <Stack gap='md'>
                  <TextInput label='チーム' value={teamQuery.data?.name ?? ''} readOnly />

                  <form.Field
                    name='wifiConfigId'
                    validators={{ onSubmit: zodFormHelpers.getFieldValidator('wifiConfigId') }}
                  >
                    {(field) => (
                      <NativeSelect
                        label='WiFi 構成'
                        data={wifiConfigs.map((config) => ({
                          value: config.id,
                          label: config.name,
                        }))}
                        value={field.state.value}
                        error={field.state.meta.errors[0]}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          handleFieldChange(field.handleChange, event.currentTarget.value);
                        }}
                      />
                    )}
                  </form.Field>

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
                      value={
                        selectedConfig?.channelWidthMHz
                          ? String(selectedConfig.channelWidthMHz)
                          : ''
                      }
                      readOnly
                    />
                  </Group>

                  <Group grow align='flex-start'>
                    <TextInput label='AP 型番' value={selectedApModel} readOnly />
                    <TextInput label='Client 型番' value={selectedClientModel} readOnly />
                  </Group>

                  <Group grow align='flex-start'>
                    <form.Field
                      name='symptom'
                      validators={{ onSubmit: zodFormHelpers.getFieldValidator('symptom') }}
                    >
                      {(field) => (
                        <NativeSelect
                          label='症状'
                          data={[
                            { value: '', label: '選択してください' },
                            ...SYMPTOMS.map((entry) => ({ value: entry, label: entry })),
                          ]}
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            handleFieldChange(field.handleChange, event.currentTarget.value);
                          }}
                        />
                      )}
                    </form.Field>

                    <form.Field
                      name='severity'
                      validators={{ onSubmit: zodFormHelpers.getFieldValidator('severity') }}
                    >
                      {(field) => (
                        <NativeSelect
                          label='深刻度'
                          data={[
                            { value: '', label: '選択してください' },
                            ...SEVERITIES.map((entry) => ({ value: entry, label: entry })),
                          ]}
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            handleFieldChange(field.handleChange, event.currentTarget.value);
                          }}
                        />
                      )}
                    </form.Field>
                  </Group>

                  <Group grow align='flex-start'>
                    <form.Field name='visibility'>
                      {(field) => (
                        <NativeSelect
                          label='公開範囲'
                          data={ISSUE_REPORT_VISIBILITIES.map((entry) => ({
                            value: entry,
                            label: entry,
                          }))}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            handleFieldChange(field.handleChange, event.currentTarget.value);
                          }}
                        />
                      )}
                    </form.Field>

                    <form.Field
                      name='reporterName'
                      validators={{
                        onChange: zodFormHelpers.getFieldValidator('reporterName'),
                        onSubmit: zodFormHelpers.getFieldValidator('reporterName'),
                      }}
                    >
                      {(field) => (
                        <TextInput
                          label='報告者名'
                          placeholder='任意'
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            handleFieldChange(field.handleChange, event.currentTarget.value);
                          }}
                        />
                      )}
                    </form.Field>
                  </Group>

                  <Group grow align='flex-start'>
                    <form.Field
                      name='avgPingMs'
                      validators={{
                        onChange: zodFormHelpers.getFieldValidator('avgPingMs'),
                        onSubmit: zodFormHelpers.getFieldValidator('avgPingMs'),
                      }}
                    >
                      {(field) => (
                        <NumberInput
                          label='平均 Ping (ms)'
                          placeholder='任意'
                          min={0}
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          onBlur={field.handleBlur}
                          onChange={(value) => {
                            handleFieldChange(
                              field.handleChange,
                              typeof value === 'number' ? value : '',
                            );
                          }}
                        />
                      )}
                    </form.Field>

                    <form.Field
                      name='packetLossPercent'
                      validators={{
                        onChange: zodFormHelpers.getFieldValidator('packetLossPercent'),
                        onSubmit: zodFormHelpers.getFieldValidator('packetLossPercent'),
                      }}
                    >
                      {(field) => (
                        <NumberInput
                          label='パケットロス率 (%)'
                          placeholder='任意'
                          min={0}
                          max={100}
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          onBlur={field.handleBlur}
                          onChange={(value) => {
                            handleFieldChange(
                              field.handleChange,
                              typeof value === 'number' ? value : '',
                            );
                          }}
                        />
                      )}
                    </form.Field>

                    <form.Field
                      name='distanceCategory'
                      validators={{
                        onChange: zodFormHelpers.getFieldValidator('distanceCategory'),
                        onSubmit: zodFormHelpers.getFieldValidator('distanceCategory'),
                      }}
                    >
                      {(field) => (
                        <NativeSelect
                          label='距離カテゴリ'
                          data={[
                            { value: '', label: '未選択' },
                            ...DISTANCE_CATEGORIES.map((entry) => ({ value: entry, label: entry })),
                          ]}
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            handleFieldChange(field.handleChange, event.currentTarget.value);
                          }}
                        />
                      )}
                    </form.Field>
                  </Group>

                  <form.Field
                    name='description'
                    validators={{
                      onChange: zodFormHelpers.getFieldValidator('description'),
                      onSubmit: zodFormHelpers.getFieldValidator('description'),
                    }}
                  >
                    {(field) => (
                      <Textarea
                        label={isDetailedMode ? '自由記述' : '一言メモ'}
                        placeholder='任意'
                        minRows={isDetailedMode ? 5 : 3}
                        value={field.state.value}
                        error={field.state.meta.errors[0]}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          handleFieldChange(field.handleChange, event.currentTarget.value);
                        }}
                      />
                    )}
                  </form.Field>

                  <Group justify='space-between'>
                    <Text fw={700}>{isDetailedMode ? '詳細モード' : '簡易モード'}</Text>
                    <Button
                      type='button'
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
                        <form.Field
                          name='maxPingMs'
                          validators={{
                            onChange: zodFormHelpers.getFieldValidator('maxPingMs'),
                            onSubmit: zodFormHelpers.getFieldValidator('maxPingMs'),
                          }}
                        >
                          {(field) => (
                            <NumberInput
                              label='最大 Ping (ms)'
                              placeholder='任意'
                              min={0}
                              value={field.state.value}
                              error={field.state.meta.errors[0]}
                              onBlur={field.handleBlur}
                              onChange={(value) => {
                                handleFieldChange(
                                  field.handleChange,
                                  typeof value === 'number' ? value : '',
                                );
                              }}
                            />
                          )}
                        </form.Field>

                        <form.Field
                          name='estimatedDistanceMeters'
                          validators={{
                            onChange: zodFormHelpers.getFieldValidator('estimatedDistanceMeters'),
                            onSubmit: zodFormHelpers.getFieldValidator('estimatedDistanceMeters'),
                          }}
                        >
                          {(field) => (
                            <NumberInput
                              label='推定距離[m]'
                              placeholder='任意'
                              min={0}
                              value={field.state.value}
                              error={field.state.meta.errors[0]}
                              onBlur={field.handleBlur}
                              onChange={(value) => {
                                handleFieldChange(
                                  field.handleChange,
                                  typeof value === 'number' ? value : '',
                                );
                              }}
                            />
                          )}
                        </form.Field>
                      </Group>

                      <Group grow align='flex-start'>
                        <form.Field
                          name='reproducibility'
                          validators={{
                            onChange: zodFormHelpers.getFieldValidator('reproducibility'),
                            onSubmit: zodFormHelpers.getFieldValidator('reproducibility'),
                          }}
                        >
                          {(field) => (
                            <NativeSelect
                              label='再現性'
                              data={[
                                { value: '', label: '未選択' },
                                ...REPRODUCIBILITIES.map((entry) => ({
                                  value: entry,
                                  label: entry,
                                })),
                              ]}
                              value={field.state.value}
                              error={field.state.meta.errors[0]}
                              onBlur={field.handleBlur}
                              onChange={(event) => {
                                handleFieldChange(field.handleChange, event.currentTarget.value);
                              }}
                            />
                          )}
                        </form.Field>

                        <form.Field name='improved'>
                          {(field) => (
                            <NativeSelect
                              label='改善有無'
                              data={[
                                { value: '', label: '未選択' },
                                { value: 'true', label: '改善した' },
                                { value: 'false', label: '改善しない' },
                              ]}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) => {
                                handleFieldChange(
                                  field.handleChange,
                                  event.currentTarget.value as '' | 'true' | 'false',
                                );
                              }}
                            />
                          )}
                        </form.Field>
                      </Group>

                      <form.Field
                        name='locationLabel'
                        validators={{
                          onChange: zodFormHelpers.getFieldValidator('locationLabel'),
                          onSubmit: zodFormHelpers.getFieldValidator('locationLabel'),
                        }}
                      >
                        {(field) => (
                          <TextInput
                            label='観測位置'
                            placeholder='任意'
                            value={field.state.value}
                            error={field.state.meta.errors[0]}
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              handleFieldChange(field.handleChange, event.currentTarget.value);
                            }}
                          />
                        )}
                      </form.Field>

                      <form.Field name='mitigationTried'>
                        {(field) => (
                          <Checkbox.Group
                            label='対処内容'
                            value={field.state.value}
                            onChange={(value) => {
                              handleFieldChange(field.handleChange, value);
                            }}
                          >
                            <Group mt='xs'>
                              {MITIGATIONS.map((entry) => (
                                <Checkbox key={entry} value={entry} label={entry} />
                              ))}
                            </Group>
                          </Checkbox.Group>
                        )}
                      </form.Field>

                      <form.Field
                        name='attachments'
                        mode='array'
                        validators={{ onSubmit: zodFormHelpers.getFieldValidator('attachments') }}
                      >
                        {(field) => (
                          <Stack gap='sm'>
                            <Group justify='space-between'>
                              <Text fw={600}>添付ファイル</Text>
                              <Button
                                type='button'
                                variant='light'
                                size='xs'
                                onClick={() => {
                                  clearMessages();
                                  field.pushValue(createEmptyIssueReportAttachment());
                                }}
                              >
                                添付を追加
                              </Button>
                            </Group>

                            {field.state.meta.errors[0] ? (
                              <Text c='red' size='sm'>
                                {field.state.meta.errors[0]}
                              </Text>
                            ) : null}

                            {field.state.value.map((attachment, index) => (
                              <Card key={attachment.id} withBorder radius='md' padding='md'>
                                <Stack gap='sm'>
                                  <Group grow align='flex-start'>
                                    <form.Field name={`attachments[${index}].name`}>
                                      {(subField) => (
                                        <TextInput
                                          label={`添付ファイル名 ${index + 1}`}
                                          value={subField.state.value}
                                          onBlur={subField.handleBlur}
                                          onChange={(event) => {
                                            handleFieldChange(
                                              subField.handleChange,
                                              event.currentTarget.value,
                                            );
                                          }}
                                        />
                                      )}
                                    </form.Field>

                                    <form.Field name={`attachments[${index}].url`}>
                                      {(subField) => (
                                        <TextInput
                                          label={`参照 URL ${index + 1}`}
                                          value={subField.state.value}
                                          onBlur={subField.handleBlur}
                                          onChange={(event) => {
                                            handleFieldChange(
                                              subField.handleChange,
                                              event.currentTarget.value,
                                            );
                                          }}
                                        />
                                      )}
                                    </form.Field>
                                  </Group>

                                  <Group grow align='flex-start'>
                                    <form.Field name={`attachments[${index}].mimeType`}>
                                      {(subField) => (
                                        <TextInput
                                          label={`MIME type ${index + 1}`}
                                          value={subField.state.value}
                                          onBlur={subField.handleBlur}
                                          onChange={(event) => {
                                            handleFieldChange(
                                              subField.handleChange,
                                              event.currentTarget.value,
                                            );
                                          }}
                                        />
                                      )}
                                    </form.Field>

                                    <form.Field name={`attachments[${index}].sizeBytes`}>
                                      {(subField) => (
                                        <NumberInput
                                          label={`サイズ (bytes) ${index + 1}`}
                                          min={0}
                                          value={subField.state.value}
                                          onBlur={subField.handleBlur}
                                          onChange={(value) => {
                                            handleFieldChange(
                                              subField.handleChange,
                                              typeof value === 'number' ? value : '',
                                            );
                                          }}
                                        />
                                      )}
                                    </form.Field>
                                  </Group>

                                  <Group justify='flex-end'>
                                    <Button
                                      type='button'
                                      color='red'
                                      variant='subtle'
                                      size='xs'
                                      onClick={() => {
                                        clearMessages();
                                        field.removeValue(index);
                                      }}
                                    >
                                      添付を削除
                                    </Button>
                                  </Group>
                                </Stack>
                              </Card>
                            ))}
                          </Stack>
                        )}
                      </form.Field>
                    </Stack>
                  ) : null}

                  <Group justify='space-between'>
                    <Button
                      component={Link}
                      to={`/tournaments/${tournamentId}/channel-map`}
                      variant='subtle'
                    >
                      チャンネルマップへ戻る
                    </Button>
                    <Group>
                      <Button
                        type='submit'
                        variant='light'
                        color='orange'
                        onClick={() => {
                          submitModeRef.current = 'offline';
                        }}
                      >
                        オフライン保存
                      </Button>
                      <Button
                        type='submit'
                        loading={
                          createIssueReportMutation.isPending && submitModeRef.current === 'create'
                        }
                        onClick={() => {
                          submitModeRef.current = 'create';
                        }}
                      >
                        報告を保存
                      </Button>
                    </Group>
                  </Group>
                </Stack>
              );
            }}
          </form.Subscribe>
        </form>
      </Stack>
    </Card>
  );
}
