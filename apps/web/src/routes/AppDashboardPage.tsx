import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Loader,
  NativeSelect,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useForm } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CreateNoticeSchema, CreateObservedWifiSchema } from '@wifiman/shared';
import { useEffect, useMemo, useState } from 'react';
import {
  ApiClientError,
  apiQueryKeys,
  type NoticeCreateInput,
  type NoticeUpdateInput,
  type ObservedWifiBulkCreateInput,
  type ObservedWifiCreateInput,
} from '../lib/api/client.js';
import { getSyncOverview } from '../lib/db/appDb.js';
import { createTanStackFormZodHelpers } from '../lib/tanstackFormZod.js';
import { parseObservedWifiCsv } from '../lib/teamManagement.js';
import {
  useBulkCreateObservedWifiMutation,
  useCreateObservedWifiMutation,
  useCreateTournamentNoticeMutation,
  useObservedWifis,
  useResendTeamAccessMutation,
  useTeamAccesses,
  useTournamentIssueReports,
  useTournamentNotices,
  useTournamentPublicOverview,
  useTournaments,
  useTournamentTeams,
  useUpdateNoticeMutation,
} from '../lib/useTeamManagement.js';

type ObservedWifiFormValues = {
  source: 'manual' | 'wild' | 'analyzer_import';
  ssid: string;
  bssid: string;
  band: '2.4GHz' | '5GHz' | '6GHz';
  channel: string;
  channelWidthMHz: string;
  rssi: string;
  locationLabel: string;
  observedAt: string;
  notes: string;
};

type NoticeFormValues = {
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  publishedAt: string;
  expiresAt: string;
};

type ObservedWifiDraft = {
  source: ObservedWifiCreateInput['source'];
  ssid?: string | null | undefined;
  bssid?: string | null | undefined;
  band: ObservedWifiCreateInput['band'];
  channel: number;
  channelWidthMHz?: number | null | undefined;
  rssi?: number | null | undefined;
  locationLabel?: string | null | undefined;
  observedAt: string;
  notes?: string | null | undefined;
};

function toDateTimeLocalValue(value: string) {
  return value.slice(0, 16);
}

function toIsoStringOrNull(value: string) {
  if (value.trim().length === 0) {
    return null;
  }

  return new Date(value).toISOString();
}

function buildObservedWifiInitialValues(): ObservedWifiFormValues {
  return {
    source: 'manual',
    ssid: '',
    bssid: '',
    band: '5GHz',
    channel: '36',
    channelWidthMHz: '20',
    rssi: '',
    locationLabel: '',
    observedAt: toDateTimeLocalValue(new Date().toISOString()),
    notes: '',
  };
}

function buildNoticeInitialValues(): NoticeFormValues {
  return {
    title: '',
    body: '',
    severity: 'info',
    publishedAt: toDateTimeLocalValue(new Date().toISOString()),
    expiresAt: '',
  };
}

function toObservedWifiInput(values: ObservedWifiDraft): ObservedWifiCreateInput {
  return {
    source: values.source,
    ssid: values.ssid ?? null,
    bssid: values.bssid ?? null,
    band: values.band,
    channel: values.channel,
    channelWidthMHz: values.channelWidthMHz ?? null,
    rssi: values.rssi ?? null,
    locationLabel: values.locationLabel ?? null,
    observedAt: values.observedAt,
    notes: values.notes ?? null,
  };
}

function toNoticeCreateInput(values: NoticeFormValues): NoticeCreateInput {
  return {
    title: values.title.trim(),
    body: values.body.trim(),
    severity: values.severity,
    publishedAt: new Date(values.publishedAt).toISOString(),
    expiresAt: toIsoStringOrNull(values.expiresAt),
  };
}

function toNoticeUpdateInput(values: NoticeFormValues): NoticeUpdateInput {
  return {
    title: values.title.trim(),
    body: values.body.trim(),
    severity: values.severity,
    publishedAt: new Date(values.publishedAt).toISOString(),
    expiresAt: toIsoStringOrNull(values.expiresAt),
  };
}

function parseObservedWifiFormValues(values: ObservedWifiFormValues): {
  data?: ObservedWifiDraft;
  errors: Partial<Record<keyof ObservedWifiFormValues, string>>;
} {
  const parsed = CreateObservedWifiSchema.omit({ tournamentId: true }).safeParse({
    source: values.source,
    ssid: values.ssid.trim() || null,
    bssid: values.bssid.trim() || null,
    band: values.band,
    channel: Number(values.channel),
    channelWidthMHz: values.channelWidthMHz.trim() ? Number(values.channelWidthMHz) : null,
    rssi: values.rssi.trim() ? Number(values.rssi) : null,
    locationLabel: values.locationLabel.trim() || null,
    observedAt: new Date(values.observedAt).toISOString(),
    notes: values.notes.trim() || null,
  });

  if (parsed.success) {
    return { data: parsed.data, errors: {} };
  }

  const errors: Partial<Record<keyof ObservedWifiFormValues, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof ObservedWifiFormValues] = issue.message;
    }
  }

  return { errors };
}

function parseNoticeFormValues(values: NoticeFormValues): {
  createInput?: NoticeCreateInput;
  updateInput?: NoticeUpdateInput;
  errors: Partial<Record<keyof NoticeFormValues, string>>;
} {
  const createInput = toNoticeCreateInput(values);
  const updateInput = toNoticeUpdateInput(values);
  const parsed = CreateNoticeSchema.omit({ tournamentId: true }).safeParse(createInput);

  if (parsed.success) {
    return { createInput, updateInput, errors: {} };
  }

  const errors: Partial<Record<keyof NoticeFormValues, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof NoticeFormValues] = issue.message;
    }
  }

  return { errors };
}

export function AppDashboardPage() {
  const tournamentsQuery = useTournaments();
  const syncOverview = useQuery({
    queryKey: apiQueryKeys.syncOverview,
    queryFn: getSyncOverview,
  });
  const observedWifiZodForm = createTanStackFormZodHelpers(CreateObservedWifiSchema);
  const noticeZodForm = createTanStackFormZodHelpers(CreateNoticeSchema);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const observedWifiForm = useForm({
    defaultValues: buildObservedWifiInitialValues(),
  });
  const csvForm = useForm({
    defaultValues: {
      csvInput: '',
    },
  });
  const noticeForm = useForm({
    defaultValues: buildNoticeInitialValues(),
  });
  const [observedWifiFieldErrors, setObservedWifiFieldErrors] = useState<
    Partial<Record<keyof ObservedWifiFormValues, string>>
  >({});
  const [csvErrors, setCsvErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [observedWifiError, setObservedWifiError] = useState<string | null>(null);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [noticeFieldErrors, setNoticeFieldErrors] = useState<
    Partial<Record<keyof NoticeFormValues, string>>
  >({});
  const [noticeError, setNoticeError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTournamentId || (tournamentsQuery.data?.length ?? 0) === 0) {
      return;
    }

    setSelectedTournamentId(tournamentsQuery.data?.[0]?.id ?? '');
  }, [selectedTournamentId, tournamentsQuery.data]);

  const overviewQuery = useTournamentPublicOverview(selectedTournamentId);
  const noticesQuery = useTournamentNotices(selectedTournamentId);
  const issueReportsQuery = useTournamentIssueReports(selectedTournamentId);
  const teamsQuery = useTournamentTeams(selectedTournamentId);
  const observedWifisQuery = useObservedWifis(selectedTournamentId);
  const teamAccessesQuery = useTeamAccesses(selectedTeamId);

  useEffect(() => {
    const teams = teamsQuery.data ?? [];

    if (teams.length === 0) {
      if (selectedTeamId) {
        setSelectedTeamId('');
      }
      return;
    }

    if (teams.some((team) => team.id === selectedTeamId)) {
      return;
    }

    setSelectedTeamId(teams[0]?.id ?? '');
  }, [selectedTeamId, teamsQuery.data]);

  const createObservedWifiMutation = useCreateObservedWifiMutation(selectedTournamentId);
  const bulkCreateObservedWifiMutation = useBulkCreateObservedWifiMutation(selectedTournamentId);
  const createNoticeMutation = useCreateTournamentNoticeMutation(selectedTournamentId);
  const updateNoticeMutation = useUpdateNoticeMutation(selectedTournamentId);
  const resendTeamAccessMutation = useResendTeamAccessMutation(selectedTeamId);

  const highSeverityReports = useMemo(() => {
    return [...(issueReportsQuery.data ?? [])]
      .filter((report) => report.severity === 'high' || report.severity === 'critical')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 5);
  }, [issueReportsQuery.data]);

  const recentReports = useMemo(() => {
    return [...(issueReportsQuery.data ?? [])]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 5);
  }, [issueReportsQuery.data]);

  const activeAccess = useMemo(() => {
    return (teamAccessesQuery.data ?? [])
      .filter((access) => !access.revokedAt)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }, [teamAccessesQuery.data]);

  const selectedTournament = tournamentsQuery.data?.find(
    (tournament) => tournament.id === selectedTournamentId,
  );
  const bandSummary = overviewQuery.data?.wifiConfigSummary;
  const bandSummaryText = `2.4GHz ${bandSummary?.['2.4GHz'] ?? 0} / 5GHz ${bandSummary?.['5GHz'] ?? 0} / 6GHz ${bandSummary?.['6GHz'] ?? 0}`;
  const issueReportCount = issueReportsQuery.data?.length ?? 0;

  const handleObservedWifiSubmit = async () => {
    const values = observedWifiForm.state.values;
    setObservedWifiError(null);
    setObservedWifiFieldErrors({});

    if (!selectedTournamentId) {
      setObservedWifiError('大会を選択してください');
      return;
    }

    const parsed = parseObservedWifiFormValues(values);
    if (!parsed.data) {
      setObservedWifiFieldErrors(parsed.errors);
      return;
    }

    try {
      await createObservedWifiMutation.mutateAsync(toObservedWifiInput(parsed.data));
      observedWifiForm.reset(buildObservedWifiInitialValues());
      notifications.show({
        color: 'teal',
        title: '野良 WiFi を登録しました',
        message: 'チャンネルマップ反映用データを更新しました。',
      });
    } catch (error) {
      setObservedWifiError(error instanceof Error ? error.message : '登録に失敗しました');
    }
  };

  const handleCsvImport = async () => {
    const csvInput = csvForm.state.values.csvInput;
    setObservedWifiError(null);

    if (!selectedTournamentId) {
      setObservedWifiError('大会を選択してください');
      return;
    }

    const parsed = parseObservedWifiCsv(csvInput);
    if (parsed.errors.length > 0) {
      setCsvErrors(parsed.errors);
      return;
    }

    setCsvErrors([]);

    try {
      const result = await bulkCreateObservedWifiMutation.mutateAsync({
        items: parsed.items.map((item) => ({
          ...toObservedWifiInput(item),
          tournamentId: selectedTournamentId,
        })),
      } satisfies ObservedWifiBulkCreateInput);

      notifications.show({
        color: 'teal',
        title: 'CSV を一括登録しました',
        message: `${result.count} 件を all-or-nothing で登録しました。`,
      });
      csvForm.reset({ csvInput: '' });
    } catch (error) {
      if (error instanceof ApiClientError) {
        const details = (
          error.payload as {
            error?: { details?: { errors?: Array<{ row: number; message: string }> } };
          }
        )?.error?.details;
        const serverErrors = details?.errors ?? [];
        if (serverErrors.length > 0) {
          setCsvErrors(serverErrors);
          return;
        }
      }

      setObservedWifiError(error instanceof Error ? error.message : 'CSV 取込に失敗しました');
    }
  };

  const handleNoticeSubmit = async () => {
    const values = noticeForm.state.values;
    setNoticeError(null);
    setNoticeFieldErrors({});

    if (!selectedTournamentId) {
      setNoticeError('大会を選択してください');
      return;
    }

    const parsed = parseNoticeFormValues(values);
    if (!parsed.createInput || !parsed.updateInput) {
      setNoticeFieldErrors(parsed.errors);
      return;
    }

    try {
      if (editingNoticeId) {
        await updateNoticeMutation.mutateAsync({ id: editingNoticeId, input: parsed.updateInput });
      } else {
        await createNoticeMutation.mutateAsync(parsed.createInput);
      }

      notifications.show({
        color: 'teal',
        title: editingNoticeId ? 'お知らせを更新しました' : 'お知らせを作成しました',
        message: '大会トップの notices を更新しました。',
      });
      setEditingNoticeId(null);
      noticeForm.reset(buildNoticeInitialValues());
    } catch (error) {
      setNoticeError(error instanceof Error ? error.message : 'お知らせ保存に失敗しました');
    }
  };

  const handleStartNoticeEdit = (notice: NonNullable<typeof noticesQuery.data>[number]) => {
    setEditingNoticeId(notice.id);
    setNoticeFieldErrors({});
    setNoticeError(null);
    noticeForm.reset({
      title: notice.title,
      body: notice.body,
      severity: notice.severity,
      publishedAt: toDateTimeLocalValue(notice.publishedAt),
      expiresAt: notice.expiresAt ? toDateTimeLocalValue(notice.expiresAt) : '',
    });
  };

  const handleResendAccess = async () => {
    if (!activeAccess) {
      return;
    }

    try {
      const result = await resendTeamAccessMutation.mutateAsync(activeAccess.id);
      notifications.show({
        color: result.delivery.status === 'failed' ? 'red' : 'teal',
        title: '編集リンクを再送しました',
        message: result.delivery.message ?? result.delivery.accessLink ?? result.message,
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: '編集リンク再送に失敗しました',
        message: error instanceof Error ? error.message : '再送に失敗しました',
      });
    }
  };

  if (tournamentsQuery.isLoading) {
    return (
      <Stack align='center' py='xl'>
        <Loader color='teal' />
        <Text c='dimmed'>operator dashboard を準備しています</Text>
      </Stack>
    );
  }

  if ((tournamentsQuery.data?.length ?? 0) === 0) {
    return (
      <Alert color='orange' title='大会がありません'>
        ダッシュボード対象の大会が存在しません。
      </Alert>
    );
  }

  return (
    <Stack gap='lg'>
      <Group justify='space-between' align='flex-start'>
        <div>
          <Title order={2}>operator dashboard</Title>
          <Text c='dimmed'>
            野良 WiFi 取込、notice、編集リンク再送、会場全体の状況を集約します。
          </Text>
        </div>
        <Badge color='teal' variant='light'>
          {selectedTournament?.name ?? 'Tournament'}
        </Badge>
      </Group>

      <Card className='feature-card' padding='lg' radius='xl'>
        <Stack gap='sm'>
          <Text size='sm' c='dimmed'>
            操作対象の大会
          </Text>
          <NativeSelect
            aria-label='大会選択'
            data={(tournamentsQuery.data ?? []).map((tournament) => ({
              value: tournament.id,
              label: `${tournament.name} / ${tournament.venueName}`,
            }))}
            value={selectedTournamentId}
            onChange={(event) => setSelectedTournamentId(event.currentTarget.value)}
          />
        </Stack>
      </Card>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, xl: 2 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Teams
            </Text>
            <Title order={3}>{overviewQuery.data?.teamCount ?? 0}</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, xl: 2 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Band Summary
            </Text>
            <Text fw={700}>{bandSummaryText}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, xl: 2 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Observed WiFi
            </Text>
            <Title order={3}>{observedWifisQuery.data?.length ?? 0}</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, xl: 2 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Issue Reports
            </Text>
            <Title order={3}>{issueReportCount}</Title>
            <Text size='sm' c='dimmed'>
              total reports {issueReportCount}
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, xl: 2 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Notices
            </Text>
            <Title order={3}>{overviewQuery.data?.noticeCount ?? 0}</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, xl: 2 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Pending Sync
            </Text>
            <Title order={3}>{syncOverview.data?.pending ?? 0}</Title>
            <Text size='sm' c='dimmed'>
              failed {syncOverview.data?.failed ?? 0} / conflict {syncOverview.data?.conflict ?? 0}
            </Text>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='md'>
              <div>
                <Title order={3}>野良 WiFi 手入力登録</Title>
                <Text c='dimmed'>観測情報を 1 件ずつ登録します。</Text>
              </div>

              <Alert color='blue' variant='light'>
                ObservedWifi の個別編集・削除は未対応です。再観測分は追加登録として扱います。
              </Alert>

              {observedWifiError ? <Alert color='red'>{observedWifiError}</Alert> : null}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleObservedWifiSubmit();
                }}
              >
                <observedWifiForm.Subscribe selector={(state) => state.values}>
                  {(_values) => (
                    <Stack gap='md'>
                      <Grid>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <observedWifiForm.Field name='source'>
                            {(field) => (
                              <NativeSelect
                                label='source'
                                data={[
                                  { value: 'manual', label: 'manual' },
                                  { value: 'wild', label: 'wild' },
                                  { value: 'analyzer_import', label: 'analyzer_import' },
                                ]}
                                value={field.state.value}
                                onChange={(event) => {
                                  setObservedWifiError(null);
                                  setObservedWifiFieldErrors({});
                                  observedWifiZodForm.getChangeHandler(field.handleChange)(
                                    event.currentTarget.value as ObservedWifiFormValues['source'],
                                  );
                                }}
                              />
                            )}
                          </observedWifiForm.Field>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <observedWifiForm.Field name='ssid'>
                            {(field) => (
                              <TextInput
                                label='SSID'
                                value={field.state.value}
                                onChange={(event) => {
                                  setObservedWifiError(null);
                                  setObservedWifiFieldErrors({});
                                  observedWifiZodForm.getChangeHandler(field.handleChange)(
                                    event.currentTarget.value,
                                  );
                                }}
                                error={observedWifiFieldErrors.ssid}
                              />
                            )}
                          </observedWifiForm.Field>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <observedWifiForm.Field name='bssid'>
                            {(field) => (
                              <TextInput
                                label='BSSID'
                                placeholder='00:11:22:33:44:55'
                                value={field.state.value}
                                onChange={(event) => {
                                  setObservedWifiError(null);
                                  setObservedWifiFieldErrors({});
                                  observedWifiZodForm.getChangeHandler(field.handleChange)(
                                    event.currentTarget.value,
                                  );
                                }}
                                error={observedWifiFieldErrors.bssid}
                              />
                            )}
                          </observedWifiForm.Field>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <observedWifiForm.Field name='band'>
                            {(field) => (
                              <NativeSelect
                                label='帯域'
                                data={['2.4GHz', '5GHz', '6GHz']}
                                value={field.state.value}
                                onChange={(event) => {
                                  setObservedWifiError(null);
                                  setObservedWifiFieldErrors({});
                                  observedWifiZodForm.getChangeHandler(field.handleChange)(
                                    event.currentTarget.value as ObservedWifiFormValues['band'],
                                  );
                                }}
                              />
                            )}
                          </observedWifiForm.Field>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <observedWifiForm.Field name='channel'>
                            {(field) => (
                              <TextInput
                                label='channel'
                                value={field.state.value}
                                onChange={(event) => {
                                  setObservedWifiError(null);
                                  setObservedWifiFieldErrors({});
                                  field.handleChange(event.currentTarget.value);
                                }}
                                error={observedWifiFieldErrors.channel}
                              />
                            )}
                          </observedWifiForm.Field>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <observedWifiForm.Field name='channelWidthMHz'>
                            {(field) => (
                              <TextInput
                                label='channel width MHz'
                                value={field.state.value}
                                onChange={(event) => {
                                  setObservedWifiError(null);
                                  setObservedWifiFieldErrors({});
                                  field.handleChange(event.currentTarget.value);
                                }}
                                error={observedWifiFieldErrors.channelWidthMHz}
                              />
                            )}
                          </observedWifiForm.Field>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 3 }}>
                          <observedWifiForm.Field name='rssi'>
                            {(field) => (
                              <TextInput
                                label='RSSI'
                                value={field.state.value}
                                onChange={(event) => {
                                  setObservedWifiError(null);
                                  setObservedWifiFieldErrors({});
                                  field.handleChange(event.currentTarget.value);
                                }}
                                error={observedWifiFieldErrors.rssi}
                              />
                            )}
                          </observedWifiForm.Field>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <observedWifiForm.Field name='locationLabel'>
                            {(field) => (
                              <TextInput
                                label='location'
                                value={field.state.value}
                                onChange={(event) => {
                                  setObservedWifiError(null);
                                  setObservedWifiFieldErrors({});
                                  observedWifiZodForm.getChangeHandler(field.handleChange)(
                                    event.currentTarget.value,
                                  );
                                }}
                                error={observedWifiFieldErrors.locationLabel}
                              />
                            )}
                          </observedWifiForm.Field>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 6 }}>
                          <observedWifiForm.Field name='observedAt'>
                            {(field) => (
                              <TextInput
                                label='observed at'
                                type='datetime-local'
                                value={field.state.value}
                                onChange={(event) => {
                                  setObservedWifiError(null);
                                  setObservedWifiFieldErrors({});
                                  field.handleChange(event.currentTarget.value);
                                }}
                                error={observedWifiFieldErrors.observedAt}
                              />
                            )}
                          </observedWifiForm.Field>
                        </Grid.Col>
                        <Grid.Col span={12}>
                          <observedWifiForm.Field name='notes'>
                            {(field) => (
                              <Textarea
                                label='notes'
                                minRows={3}
                                value={field.state.value}
                                onChange={(event) => {
                                  setObservedWifiError(null);
                                  setObservedWifiFieldErrors({});
                                  observedWifiZodForm.getChangeHandler(field.handleChange)(
                                    event.currentTarget.value,
                                  );
                                }}
                                error={observedWifiFieldErrors.notes}
                              />
                            )}
                          </observedWifiForm.Field>
                        </Grid.Col>
                      </Grid>

                      <Group justify='flex-end'>
                        <Button type='submit' loading={createObservedWifiMutation.isPending}>
                          野良 WiFi を登録
                        </Button>
                      </Group>
                    </Stack>
                  )}
                </observedWifiForm.Subscribe>
              </form>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='md'>
              <div>
                <Title order={3}>CSV 取込</Title>
                <Text c='dimmed'>
                  1 行目は header、2 行目以降を検証します。行番号付きエラーが 1
                  件でもあれば全件未登録です。
                </Text>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleCsvImport();
                }}
              >
                <Stack gap='md'>
                  <csvForm.Field name='csvInput'>
                    {(field) => (
                      <Textarea
                        label='CSV'
                        minRows={10}
                        placeholder='source,ssid,bssid,band,channel,channelWidthMHz,rssi,locationLabel,observedAt,notes'
                        value={field.state.value}
                        onChange={(event) => {
                          setObservedWifiError(null);
                          setCsvErrors([]);
                          field.handleChange(event.currentTarget.value);
                        }}
                      />
                    )}
                  </csvForm.Field>

                  {csvErrors.length > 0 ? (
                    <Alert color='red' title='CSV バリデーション'>
                      {csvErrors.map((error) => (
                        <Text key={`${error.row}-${error.message}`}>{error.message}</Text>
                      ))}
                    </Alert>
                  ) : (
                    <Alert color='blue' variant='light'>
                      一括登録は all-or-nothing です。1 行でも無効なら登録しません。
                    </Alert>
                  )}

                  <Group justify='flex-end'>
                    <Button type='submit' loading={bulkCreateObservedWifiMutation.isPending}>
                      CSV を一括登録
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, xl: 6 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='md'>
              <div>
                <Title order={3}>高深刻度レポート</Title>
                <Text c='dimmed'>critical / high の最近更新順です。</Text>
              </div>

              {highSeverityReports.length === 0 ? (
                <Text c='dimmed'>高深刻度レポートはありません。</Text>
              ) : (
                highSeverityReports.map((report) => (
                  <Card key={report.id} withBorder>
                    <Stack gap='xs'>
                      <Group justify='space-between'>
                        <Text fw={700}>{report.symptom}</Text>
                        <Badge color={report.severity === 'critical' ? 'red' : 'orange'}>
                          {report.severity}
                        </Badge>
                      </Group>
                      <Text size='sm' c='dimmed'>
                        team {report.teamId} / updated{' '}
                        {new Date(report.updatedAt).toLocaleString('ja-JP')}
                      </Text>
                      <Button
                        component={Link}
                        size='xs'
                        to={`/tournaments/${selectedTournamentId}/issue-reports/${report.id}`}
                        variant='light'
                      >
                        詳細を開く
                      </Button>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 6 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='md'>
              <div>
                <Title order={3}>最近更新</Title>
                <Text c='dimmed'>会場全体の recent updates を確認します。</Text>
              </div>

              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>symptom</Table.Th>
                    <Table.Th>severity</Table.Th>
                    <Table.Th>updated</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {recentReports.map((report) => (
                    <Table.Tr key={report.id}>
                      <Table.Td>{report.symptom}</Table.Td>
                      <Table.Td>{report.severity}</Table.Td>
                      <Table.Td>{new Date(report.updatedAt).toLocaleString('ja-JP')}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='md'>
              <Group justify='space-between'>
                <div>
                  <Title order={3}>Notice 作成 / 編集</Title>
                  <Text c='dimmed'>大会トップに表示する notices を管理します。</Text>
                </div>
                {editingNoticeId ? (
                  <Button
                    variant='subtle'
                    onClick={() => {
                      setEditingNoticeId(null);
                      setNoticeFieldErrors({});
                      setNoticeError(null);
                      noticeForm.reset(buildNoticeInitialValues());
                    }}
                  >
                    新規に戻す
                  </Button>
                ) : null}
              </Group>

              {noticeError ? <Alert color='red'>{noticeError}</Alert> : null}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleNoticeSubmit();
                }}
              >
                <Stack gap='md'>
                  <noticeForm.Field name='title'>
                    {(field) => (
                      <TextInput
                        label='title'
                        value={field.state.value}
                        onChange={(event) => {
                          setNoticeError(null);
                          setNoticeFieldErrors({});
                          noticeZodForm.getChangeHandler(field.handleChange)(
                            event.currentTarget.value,
                          );
                        }}
                        error={noticeFieldErrors.title}
                      />
                    )}
                  </noticeForm.Field>
                  <noticeForm.Field name='body'>
                    {(field) => (
                      <Textarea
                        label='body'
                        minRows={4}
                        value={field.state.value}
                        onChange={(event) => {
                          setNoticeError(null);
                          setNoticeFieldErrors({});
                          noticeZodForm.getChangeHandler(field.handleChange)(
                            event.currentTarget.value,
                          );
                        }}
                        error={noticeFieldErrors.body}
                      />
                    )}
                  </noticeForm.Field>
                  <Grid>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <noticeForm.Field name='severity'>
                        {(field) => (
                          <NativeSelect
                            label='severity'
                            data={['info', 'warning', 'critical']}
                            value={field.state.value}
                            onChange={(event) => {
                              setNoticeError(null);
                              setNoticeFieldErrors({});
                              noticeZodForm.getChangeHandler(field.handleChange)(
                                event.currentTarget.value as NoticeFormValues['severity'],
                              );
                            }}
                          />
                        )}
                      </noticeForm.Field>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <noticeForm.Field name='publishedAt'>
                        {(field) => (
                          <TextInput
                            label='published at'
                            type='datetime-local'
                            value={field.state.value}
                            onChange={(event) => {
                              setNoticeError(null);
                              setNoticeFieldErrors({});
                              field.handleChange(event.currentTarget.value);
                            }}
                            error={noticeFieldErrors.publishedAt}
                          />
                        )}
                      </noticeForm.Field>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <noticeForm.Field name='expiresAt'>
                        {(field) => (
                          <TextInput
                            label='expires at'
                            type='datetime-local'
                            value={field.state.value}
                            onChange={(event) => {
                              setNoticeError(null);
                              setNoticeFieldErrors({});
                              field.handleChange(event.currentTarget.value);
                            }}
                            error={noticeFieldErrors.expiresAt}
                          />
                        )}
                      </noticeForm.Field>
                    </Grid.Col>
                  </Grid>

                  <Group justify='flex-end'>
                    <Button
                      type='submit'
                      loading={createNoticeMutation.isPending || updateNoticeMutation.isPending}
                    >
                      {editingNoticeId ? 'お知らせを更新' : 'お知らせを作成'}
                    </Button>
                  </Group>
                </Stack>
              </form>

              <Divider />

              {(noticesQuery.data ?? []).map((notice) => (
                <Card key={notice.id} withBorder>
                  <Stack gap='xs'>
                    <Group justify='space-between'>
                      <Text fw={700}>{notice.title}</Text>
                      <Badge
                        color={
                          notice.severity === 'critical'
                            ? 'red'
                            : notice.severity === 'warning'
                              ? 'orange'
                              : 'blue'
                        }
                      >
                        {notice.severity}
                      </Badge>
                    </Group>
                    <Text size='sm'>{notice.body}</Text>
                    <Group justify='space-between'>
                      <Text size='sm' c='dimmed'>
                        published {new Date(notice.publishedAt).toLocaleString('ja-JP')}
                      </Text>
                      <Button
                        size='xs'
                        variant='light'
                        onClick={() => handleStartNoticeEdit(notice)}
                      >
                        編集
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='md'>
              <div>
                <Title order={3}>編集リンク再送</Title>
                <Text c='dimmed'>チームごとの active team access を再送します。</Text>
              </div>

              <NativeSelect
                aria-label='チーム選択'
                data={(teamsQuery.data ?? []).map((team) => ({
                  value: team.id,
                  label: team.name,
                }))}
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.currentTarget.value)}
              />

              {activeAccess ? (
                <Card withBorder>
                  <Stack gap='xs'>
                    <Text fw={700}>{activeAccess.email}</Text>
                    <Text size='sm' c='dimmed'>
                      role {activeAccess.role} / last used{' '}
                      {activeAccess.lastUsedAt
                        ? new Date(activeAccess.lastUsedAt).toLocaleString('ja-JP')
                        : '未使用'}
                    </Text>
                    <Group justify='space-between'>
                      <Button
                        component={Link}
                        size='xs'
                        to={`/tournaments/${selectedTournamentId}/teams/${selectedTeamId}`}
                        variant='subtle'
                      >
                        チーム詳細
                      </Button>
                      <Button
                        size='xs'
                        loading={resendTeamAccessMutation.isPending}
                        onClick={() => void handleResendAccess()}
                      >
                        編集リンクを再送
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              ) : (
                <Alert color='orange'>active な team access がありません。</Alert>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
