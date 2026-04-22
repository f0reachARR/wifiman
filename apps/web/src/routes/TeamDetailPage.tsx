import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Grid,
  Group,
  Loader,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  CHANNEL_WIDTHS,
  DEVICE_KINDS,
  PURPOSES,
  WIFI_CONFIG_ROLES,
  WIFI_CONFIG_STATUSES,
} from '@wifiman/shared';
import { useEffect, useMemo, useState } from 'react';
import type {
  BestPracticeView,
  DeviceSpecCreateInput,
  DeviceSpecUpdateInput,
  DeviceSpecView,
  IssueReportView,
  TeamUpdateInput,
  TeamView,
  WifiConfigCreateInput,
  WifiConfigUpdateInput,
  WifiConfigView,
} from '../lib/api/client.js';
import { canEditTeamResources, canViewTeamPrivateFields, isOwnTeam } from '../lib/authz.js';
import { listIssueReportSyncRecords } from '../lib/db/appDb.js';
import {
  createTanStackFormZodHelpers,
  toGlobalFormValidationError,
} from '../lib/tanstackFormZod.js';
import {
  buildDeviceSpecFormValues,
  buildTeamFormValues,
  buildWifiConfigFormValues,
  countActiveWifiConfigs,
  DeviceSpecEditorSchema,
  type DeviceSpecFormValues,
  findRelevantBestPractices,
  getBandOptions,
  parseDeviceSpecFormValues,
  parseTeamFormValues,
  parseWifiConfigFormValues,
  TeamEditorSchema,
  type TeamFormValues,
  WifiConfigEditorSchema,
  type WifiConfigFormValues,
} from '../lib/teamManagement.js';
import { useAuthSession } from '../lib/useAuthSession.js';
import {
  useArchiveDeviceSpecMutation,
  useCreateDeviceSpecMutation,
  useCreateWifiConfigMutation,
  useDisableWifiConfigMutation,
  useTeam,
  useTeamDeviceSpecs,
  useTeamWifiConfigs,
  useTournamentBestPractices,
  useTournamentIssueReports,
  useUpdateDeviceSpecMutation,
  useUpdateTeamMutation,
  useUpdateWifiConfigMutation,
} from '../lib/useTeamManagement.js';

type TeamDetailPageProps = {
  tournamentId: string;
  teamId: string;
};

type TeamEditorProps = {
  team: TeamView;
  canEdit: boolean;
  canSeePrivateFields: boolean;
  onSubmit: (values: TeamFormValues) => Promise<void>;
  saving: boolean;
};

type WifiEditorProps = {
  initialValues: WifiConfigFormValues;
  configs: ReadonlyArray<Pick<WifiConfigView, 'id' | 'status' | 'band' | 'name'>>;
  deviceSpecs: ReadonlyArray<DeviceSpecView>;
  canEdit: boolean;
  editingId?: string;
  bestPractices: ReadonlyArray<BestPracticeView>;
  onCancel: () => void;
  onSubmit: (values: WifiConfigFormValues) => Promise<void>;
  submitting: boolean;
};

function hasWifiPrivateFields(config: WifiConfigView): config is WifiConfigView & {
  pingTargetIp?: string | null;
  notes?: string | null;
} {
  return 'pingTargetIp' in config || 'notes' in config;
}

function hasDevicePrivateFields(spec: DeviceSpecView): spec is DeviceSpecView & {
  notes?: string | null;
  archivedAt?: string | null;
} {
  return 'notes' in spec || 'archivedAt' in spec;
}

function isDetailedIssueReport(report: IssueReportView): report is IssueReportView & {
  reporterName?: string | null;
  locationLabel?: string | null;
  description?: string | null;
} {
  return 'reporterName' in report || 'locationLabel' in report || 'description' in report;
}

function toTeamUpdateInput(input: {
  name?: string | undefined;
  organization?: string | null | undefined;
  pitId?: string | null | undefined;
  contactEmail?: string | null | undefined;
  displayContactName?: string | null | undefined;
  notes?: string | null | undefined;
}): TeamUpdateInput {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.organization !== undefined ? { organization: input.organization } : {}),
    ...(input.pitId !== undefined ? { pitId: input.pitId } : {}),
    ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
    ...(input.displayContactName !== undefined
      ? { displayContactName: input.displayContactName }
      : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
}

function toWifiConfigInput(input: {
  name: string;
  purpose: NonNullable<WifiConfigCreateInput['purpose']>;
  band: NonNullable<WifiConfigCreateInput['band']>;
  channel: number;
  channelWidthMHz: NonNullable<WifiConfigCreateInput['channelWidthMHz']>;
  role: NonNullable<WifiConfigCreateInput['role']>;
  status: NonNullable<WifiConfigCreateInput['status']>;
  apDeviceId?: string | undefined;
  clientDeviceId?: string | undefined;
  expectedDistanceCategory?: WifiConfigCreateInput['expectedDistanceCategory'] | undefined;
  pingTargetIp?: string | undefined;
  notes?: string | undefined;
}): WifiConfigCreateInput {
  return {
    name: input.name,
    purpose: input.purpose,
    band: input.band,
    channel: input.channel,
    channelWidthMHz: input.channelWidthMHz,
    role: input.role,
    status: input.status,
    ...(input.apDeviceId !== undefined ? { apDeviceId: input.apDeviceId } : {}),
    ...(input.clientDeviceId !== undefined ? { clientDeviceId: input.clientDeviceId } : {}),
    ...(input.expectedDistanceCategory !== undefined
      ? { expectedDistanceCategory: input.expectedDistanceCategory }
      : {}),
    ...(input.pingTargetIp !== undefined ? { pingTargetIp: input.pingTargetIp } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
}

function toWifiConfigUpdateInput(input: {
  name: string;
  purpose: NonNullable<WifiConfigCreateInput['purpose']>;
  band: NonNullable<WifiConfigCreateInput['band']>;
  channel: number;
  channelWidthMHz: NonNullable<WifiConfigCreateInput['channelWidthMHz']>;
  role: NonNullable<WifiConfigCreateInput['role']>;
  status: NonNullable<WifiConfigCreateInput['status']>;
  apDeviceId?: string | undefined;
  clientDeviceId?: string | undefined;
  expectedDistanceCategory?: WifiConfigUpdateInput['expectedDistanceCategory'] | undefined;
  pingTargetIp?: string | undefined;
  notes?: string | undefined;
}): WifiConfigUpdateInput {
  return {
    name: input.name,
    purpose: input.purpose,
    band: input.band,
    channel: input.channel,
    channelWidthMHz: input.channelWidthMHz,
    role: input.role,
    status: input.status,
    ...(input.apDeviceId !== undefined ? { apDeviceId: input.apDeviceId } : {}),
    ...(input.clientDeviceId !== undefined ? { clientDeviceId: input.clientDeviceId } : {}),
    ...(input.expectedDistanceCategory !== undefined
      ? { expectedDistanceCategory: input.expectedDistanceCategory }
      : {}),
    ...(input.pingTargetIp !== undefined ? { pingTargetIp: input.pingTargetIp } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
}

function toDeviceSpecInput(input: {
  model: string;
  kind: NonNullable<DeviceSpecCreateInput['kind']>;
  supportedBands: NonNullable<DeviceSpecCreateInput['supportedBands']>;
  vendor?: string | undefined;
  notes?: string | undefined;
  knownIssues?: string | undefined;
}): DeviceSpecCreateInput {
  return {
    model: input.model,
    kind: input.kind,
    supportedBands: input.supportedBands,
    ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.knownIssues !== undefined ? { knownIssues: input.knownIssues } : {}),
  };
}

function toDeviceSpecUpdateInput(input: {
  model: string;
  kind: NonNullable<DeviceSpecCreateInput['kind']>;
  supportedBands: NonNullable<DeviceSpecCreateInput['supportedBands']>;
  vendor?: string | undefined;
  notes?: string | undefined;
  knownIssues?: string | undefined;
}): DeviceSpecUpdateInput {
  return {
    model: input.model,
    kind: input.kind,
    supportedBands: input.supportedBands,
    ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.knownIssues !== undefined ? { knownIssues: input.knownIssues } : {}),
  };
}

function TeamEditorSection({
  team,
  canEdit,
  canSeePrivateFields,
  onSubmit,
  saving,
}: TeamEditorProps) {
  const zodForm = createTanStackFormZodHelpers(TeamEditorSchema);
  const form = useForm({
    defaultValues: buildTeamFormValues(team),
    validators: {
      onSubmit: ({ value }) =>
        toGlobalFormValidationError<TeamFormValues>(parseTeamFormValues(value).errors),
    },
    onSubmit: async ({ value }) => {
      const parsed = parseTeamFormValues(value);
      if (!parsed.data) {
        return;
      }

      await onSubmit(value);
    },
  });

  useEffect(() => {
    form.reset(buildTeamFormValues(team));
  }, [form, team]);

  return (
    <Card className='feature-card' padding='lg' radius='xl'>
      <Stack gap='md'>
        <Group justify='space-between'>
          <Title order={3}>チーム情報</Title>
          <Badge color={canEdit ? 'teal' : 'gray'} variant='light'>
            {canEdit ? '編集可能' : '閲覧専用'}
          </Badge>
        </Group>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <Stack gap='md'>
            <form.Field
              name='name'
              validators={{
                onChange: zodForm.getFieldValidator('name'),
                onSubmit: zodForm.getFieldValidator('name'),
              }}
            >
              {(field) => (
                <TextInput
                  label='チーム名'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    zodForm.getChangeHandler(field.handleChange)(event.currentTarget.value)
                  }
                  error={field.state.meta.errors[0]}
                  disabled={!canEdit}
                />
              )}
            </form.Field>
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <form.Field
                  name='organization'
                  validators={{
                    onChange: zodForm.getFieldValidator('organization'),
                    onSubmit: zodForm.getFieldValidator('organization'),
                  }}
                >
                  {(field) => (
                    <TextInput
                      label='学校・団体名'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        zodForm.getChangeHandler(field.handleChange)(event.currentTarget.value)
                      }
                      error={field.state.meta.errors[0]}
                      disabled={!canEdit}
                    />
                  )}
                </form.Field>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <form.Field
                  name='pitId'
                  validators={{
                    onChange: zodForm.getFieldValidator('pitId'),
                    onSubmit: zodForm.getFieldValidator('pitId'),
                  }}
                >
                  {(field) => (
                    <TextInput
                      label='ピット番号'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        zodForm.getChangeHandler(field.handleChange)(event.currentTarget.value)
                      }
                      error={field.state.meta.errors[0]}
                      disabled={!canEdit}
                    />
                  )}
                </form.Field>
              </Grid.Col>
            </Grid>

            {canSeePrivateFields ? (
              <>
                <Grid>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <form.Field
                      name='contactEmail'
                      validators={{
                        onChange: zodForm.getFieldValidator('contactEmail'),
                        onSubmit: zodForm.getFieldValidator('contactEmail'),
                      }}
                    >
                      {(field) => (
                        <TextInput
                          label='代表メールアドレス'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            zodForm.getChangeHandler(field.handleChange)(event.currentTarget.value)
                          }
                          error={field.state.meta.errors[0]}
                          disabled={!canEdit}
                        />
                      )}
                    </form.Field>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <form.Field
                      name='displayContactName'
                      validators={{
                        onChange: zodForm.getFieldValidator('displayContactName'),
                        onSubmit: zodForm.getFieldValidator('displayContactName'),
                      }}
                    >
                      {(field) => (
                        <TextInput
                          label='表示用連絡先名'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            zodForm.getChangeHandler(field.handleChange)(event.currentTarget.value)
                          }
                          error={field.state.meta.errors[0]}
                          disabled={!canEdit}
                        />
                      )}
                    </form.Field>
                  </Grid.Col>
                </Grid>

                <form.Field
                  name='notes'
                  validators={{
                    onChange: zodForm.getFieldValidator('notes'),
                    onSubmit: zodForm.getFieldValidator('notes'),
                  }}
                >
                  {(field) => (
                    <Textarea
                      label='メモ'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        zodForm.getChangeHandler(field.handleChange)(event.currentTarget.value)
                      }
                      error={field.state.meta.errors[0]}
                      minRows={4}
                      disabled={!canEdit}
                    />
                  )}
                </form.Field>
              </>
            ) : (
              <Alert color='gray' variant='light'>
                他チーム閲覧時は連絡先情報と内部メモを表示しません。
              </Alert>
            )}

            {canEdit ? (
              <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                  <Group justify='flex-end'>
                    <Button
                      type='submit'
                      disabled={!canSubmit}
                      loading={saving || Boolean(isSubmitting)}
                    >
                      チーム情報を保存
                    </Button>
                  </Group>
                )}
              </form.Subscribe>
            ) : null}
          </Stack>
        </form>
      </Stack>
    </Card>
  );
}

function WifiConfigEditorSection({
  initialValues,
  configs,
  deviceSpecs,
  canEdit,
  editingId,
  bestPractices,
  onCancel,
  onSubmit,
  submitting,
}: WifiEditorProps) {
  const zodForm = createTanStackFormZodHelpers(WifiConfigEditorSchema);
  const [errors, setErrors] = useState<Partial<Record<keyof WifiConfigFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: initialValues,
  });

  useEffect(() => {
    form.reset(initialValues);
    setErrors({});
    setFormError(null);
  }, [form, initialValues]);

  const clearValidationState = () => {
    setErrors({});
    setFormError(null);
  };

  return (
    <Card className='feature-card' padding='lg' radius='xl'>
      <Stack gap='md'>
        <Group justify='space-between'>
          <Title order={4}>{editingId ? 'WiFi 構成を編集' : 'WiFi 構成を追加'}</Title>
          <Button variant='subtle' color='gray' onClick={onCancel}>
            閉じる
          </Button>
        </Group>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const values = form.state.values;
            const parsed = parseWifiConfigFormValues(
              values,
              configs.map((config) => ({ id: config.id, status: config.status })),
              editingId,
            );

            setErrors(parsed.errors);
            setFormError(parsed.formError ?? null);
            if (!parsed.data) {
              return;
            }

            await onSubmit(values);
          }}
        >
          <form.Subscribe selector={(state) => state.values}>
            {(values) => {
              const sameBandConfigs = configs.filter(
                (config) => config.band === values.band && config.id !== editingId,
              );
              const selectedDeviceSpecs = [values.apDeviceId, values.clientDeviceId]
                .map((id) => deviceSpecs.find((spec) => spec.id === id))
                .filter((spec): spec is DeviceSpecView => spec != null);
              const bestPracticeBodies = findRelevantBestPractices(
                bestPractices,
                values.band,
                values.purpose,
                selectedDeviceSpecs.map((spec) => spec.model),
              ).map((practice) => practice.body);
              const knownIssueSummaries = selectedDeviceSpecs
                .filter((spec) => Boolean(spec.knownIssues))
                .map((spec) => `${spec.model}: ${spec.knownIssues}`);

              return (
                <Stack gap='md'>
                  {formError ? (
                    <Alert color='red' variant='light'>
                      {formError}
                    </Alert>
                  ) : null}

                  <Grid>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <form.Field
                        name='name'
                        validators={{
                          onChange: zodForm.getFieldValidator('name'),
                          onSubmit: zodForm.getFieldValidator('name'),
                        }}
                      >
                        {(field) => (
                          <TextInput
                            label='構成名'
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              clearValidationState();
                              zodForm.getChangeHandler(field.handleChange)(
                                event.currentTarget.value,
                              );
                            }}
                            error={field.state.meta.errors[0] ?? errors.name}
                            disabled={!canEdit}
                          />
                        )}
                      </form.Field>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <form.Field name='purpose'>
                        {(field) => (
                          <Select
                            label='用途'
                            data={PURPOSES.map((value) => ({ value, label: value }))}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(value) => {
                              clearValidationState();
                              zodForm.getChangeHandler(field.handleChange)(
                                (value ?? 'control') as WifiConfigFormValues['purpose'],
                              );
                            }}
                            allowDeselect={false}
                            disabled={!canEdit}
                          />
                        )}
                      </form.Field>
                    </Grid.Col>
                  </Grid>

                  <Grid>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <form.Field name='band'>
                        {(field) => (
                          <Select
                            label='帯域'
                            data={getBandOptions().map((value) => ({ value, label: value }))}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(value) => {
                              clearValidationState();
                              zodForm.getChangeHandler(field.handleChange)(
                                (value ?? '5GHz') as WifiConfigFormValues['band'],
                              );
                            }}
                            allowDeselect={false}
                            disabled={!canEdit}
                          />
                        )}
                      </form.Field>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <form.Field name='channel'>
                        {(field) => (
                          <TextInput
                            label='チャンネル'
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              clearValidationState();
                              field.handleChange(event.currentTarget.value);
                            }}
                            error={errors.channel}
                            disabled={!canEdit}
                          />
                        )}
                      </form.Field>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <form.Field name='channelWidthMHz'>
                        {(field) => (
                          <Select
                            label='幅 (MHz)'
                            data={CHANNEL_WIDTHS.map((value) => ({
                              value: String(value),
                              label: `${value} MHz`,
                            }))}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(value) => {
                              clearValidationState();
                              field.handleChange(value ?? String(CHANNEL_WIDTHS[0]));
                            }}
                            error={errors.channelWidthMHz}
                            allowDeselect={false}
                            disabled={!canEdit}
                          />
                        )}
                      </form.Field>
                    </Grid.Col>
                  </Grid>

                  <Grid>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <form.Field name='role'>
                        {(field) => (
                          <Select
                            label='役割'
                            data={WIFI_CONFIG_ROLES.map((value) => ({ value, label: value }))}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(value) => {
                              clearValidationState();
                              zodForm.getChangeHandler(field.handleChange)(
                                (value ?? 'primary') as WifiConfigFormValues['role'],
                              );
                            }}
                            allowDeselect={false}
                            disabled={!canEdit}
                          />
                        )}
                      </form.Field>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <form.Field name='status'>
                        {(field) => (
                          <Select
                            label='状態'
                            data={WIFI_CONFIG_STATUSES.map((value) => ({ value, label: value }))}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(value) => {
                              clearValidationState();
                              zodForm.getChangeHandler(field.handleChange)(
                                (value ?? 'active') as WifiConfigFormValues['status'],
                              );
                            }}
                            allowDeselect={false}
                            disabled={!canEdit}
                          />
                        )}
                      </form.Field>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <form.Field name='expectedDistanceCategory'>
                        {(field) => (
                          <Select
                            label='想定距離'
                            data={[
                              { value: '', label: '未設定' },
                              { value: 'near', label: 'near' },
                              { value: 'mid', label: 'mid' },
                              { value: 'far', label: 'far' },
                            ]}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(value) => {
                              clearValidationState();
                              zodForm.getChangeHandler(field.handleChange)(
                                value === null
                                  ? ''
                                  : (value as WifiConfigFormValues['expectedDistanceCategory']),
                              );
                            }}
                            allowDeselect={false}
                            disabled={!canEdit}
                          />
                        )}
                      </form.Field>
                    </Grid.Col>
                  </Grid>

                  <Grid>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <form.Field name='apDeviceId'>
                        {(field) => (
                          <Select
                            label='AP 機材'
                            data={[
                              { value: '', label: '未選択' },
                              ...deviceSpecs.map((spec) => ({
                                value: spec.id,
                                label: `${spec.vendor ?? 'Unknown'} ${spec.model}`,
                              })),
                            ]}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(value) => {
                              clearValidationState();
                              zodForm.getChangeHandler(field.handleChange)(value ?? '');
                            }}
                            allowDeselect={false}
                            disabled={!canEdit}
                          />
                        )}
                      </form.Field>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <form.Field name='clientDeviceId'>
                        {(field) => (
                          <Select
                            label='クライアント機材'
                            data={[
                              { value: '', label: '未選択' },
                              ...deviceSpecs.map((spec) => ({
                                value: spec.id,
                                label: `${spec.vendor ?? 'Unknown'} ${spec.model}`,
                              })),
                            ]}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(value) => {
                              clearValidationState();
                              zodForm.getChangeHandler(field.handleChange)(value ?? '');
                            }}
                            allowDeselect={false}
                            disabled={!canEdit}
                          />
                        )}
                      </form.Field>
                    </Grid.Col>
                  </Grid>

                  <form.Field
                    name='pingTargetIp'
                    validators={{
                      onChange: zodForm.getFieldValidator('pingTargetIp'),
                      onSubmit: zodForm.getFieldValidator('pingTargetIp'),
                    }}
                  >
                    {(field) => (
                      <TextInput
                        label='Ping 監視先 IP'
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          clearValidationState();
                          zodForm.getChangeHandler(field.handleChange)(event.currentTarget.value);
                        }}
                        error={field.state.meta.errors[0] ?? errors.pingTargetIp}
                        disabled={!canEdit}
                      />
                    )}
                  </form.Field>

                  <form.Field
                    name='notes'
                    validators={{
                      onChange: zodForm.getFieldValidator('notes'),
                      onSubmit: zodForm.getFieldValidator('notes'),
                    }}
                  >
                    {(field) => (
                      <Textarea
                        label='メモ'
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          clearValidationState();
                          zodForm.getChangeHandler(field.handleChange)(event.currentTarget.value);
                        }}
                        error={field.state.meta.errors[0] ?? errors.notes}
                        minRows={3}
                        disabled={!canEdit}
                      />
                    )}
                  </form.Field>

                  <Alert color='blue' variant='light'>
                    同帯域の既存構成:{' '}
                    {sameBandConfigs.length === 0
                      ? 'なし'
                      : sameBandConfigs
                          .map((config) => `${config.name} (${config.status})`)
                          .join(' / ')}
                  </Alert>

                  {bestPracticeBodies.length > 0 ? (
                    <Alert color='teal' variant='light' title='関連ベストプラクティス'>
                      <Stack gap='xs'>
                        {bestPracticeBodies.map((body) => (
                          <Text key={body} size='sm'>
                            {body}
                          </Text>
                        ))}
                      </Stack>
                    </Alert>
                  ) : null}

                  {knownIssueSummaries.length > 0 ? (
                    <Alert color='orange' variant='light' title='関連機材の既知の注意点'>
                      <Stack gap='xs'>
                        {knownIssueSummaries.map((issue) => (
                          <Text key={issue} size='sm'>
                            {issue}
                          </Text>
                        ))}
                      </Stack>
                    </Alert>
                  ) : null}

                  {canEdit ? (
                    <Group justify='flex-end'>
                      <Button type='submit' loading={submitting}>
                        保存
                      </Button>
                    </Group>
                  ) : null}
                </Stack>
              );
            }}
          </form.Subscribe>
        </form>
      </Stack>
    </Card>
  );
}

type DeviceEditorProps = {
  initialValues: DeviceSpecFormValues;
  canEdit: boolean;
  onCancel: () => void;
  onSubmit: (values: DeviceSpecFormValues) => Promise<void>;
  submitting: boolean;
};

function DeviceSpecEditorSection({
  initialValues,
  canEdit,
  onCancel,
  onSubmit,
  submitting,
}: DeviceEditorProps) {
  const zodForm = createTanStackFormZodHelpers(DeviceSpecEditorSchema);
  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: ({ value }) =>
        toGlobalFormValidationError<DeviceSpecFormValues>(parseDeviceSpecFormValues(value).errors),
    },
    onSubmit: async ({ value }) => {
      const parsed = parseDeviceSpecFormValues(value);
      if (!parsed.data) {
        return;
      }

      await onSubmit(value);
    },
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  return (
    <Card className='feature-card' padding='lg' radius='xl'>
      <Stack gap='md'>
        <Group justify='space-between'>
          <Title order={4}>機材仕様</Title>
          <Button variant='subtle' color='gray' onClick={onCancel}>
            閉じる
          </Button>
        </Group>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <Stack gap='md'>
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <form.Field
                  name='vendor'
                  validators={{
                    onChange: zodForm.getFieldValidator('vendor'),
                    onSubmit: zodForm.getFieldValidator('vendor'),
                  }}
                >
                  {(field) => (
                    <TextInput
                      label='メーカー'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        zodForm.getChangeHandler(field.handleChange)(event.currentTarget.value)
                      }
                      error={field.state.meta.errors[0]}
                      disabled={!canEdit}
                    />
                  )}
                </form.Field>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <form.Field
                  name='model'
                  validators={{
                    onChange: zodForm.getFieldValidator('model'),
                    onSubmit: zodForm.getFieldValidator('model'),
                  }}
                >
                  {(field) => (
                    <TextInput
                      label='型番'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        zodForm.getChangeHandler(field.handleChange)(event.currentTarget.value)
                      }
                      error={field.state.meta.errors[0]}
                      disabled={!canEdit}
                    />
                  )}
                </form.Field>
              </Grid.Col>
            </Grid>

            <form.Field name='kind'>
              {(field) => (
                <Select
                  label='種別'
                  data={DEVICE_KINDS.map((value) => ({ value, label: value }))}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(value) =>
                    zodForm.getChangeHandler(field.handleChange)(
                      (value ?? 'ap') as DeviceSpecFormValues['kind'],
                    )
                  }
                  allowDeselect={false}
                  disabled={!canEdit}
                />
              )}
            </form.Field>

            <form.Field
              name='supportedBands'
              validators={{
                onSubmit: zodForm.getFieldValidator('supportedBands'),
              }}
            >
              {(field) => (
                <>
                  <Checkbox.Group
                    label='対応帯域'
                    value={field.state.value}
                    onChange={(next) =>
                      zodForm.getChangeHandler(field.handleChange)(
                        next as DeviceSpecFormValues['supportedBands'],
                      )
                    }
                  >
                    <Group mt='xs'>
                      {getBandOptions().map((band) => (
                        <Checkbox key={band} value={band} label={band} disabled={!canEdit} />
                      ))}
                    </Group>
                  </Checkbox.Group>
                  {field.state.meta.errors[0] ? (
                    <Text c='red'>{field.state.meta.errors[0]}</Text>
                  ) : null}
                </>
              )}
            </form.Field>

            <form.Field
              name='knownIssues'
              validators={{
                onChange: zodForm.getFieldValidator('knownIssues'),
                onSubmit: zodForm.getFieldValidator('knownIssues'),
              }}
            >
              {(field) => (
                <Textarea
                  label='既知の注意点'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    zodForm.getChangeHandler(field.handleChange)(event.currentTarget.value)
                  }
                  error={field.state.meta.errors[0]}
                  minRows={3}
                  disabled={!canEdit}
                />
              )}
            </form.Field>

            <form.Field
              name='notes'
              validators={{
                onChange: zodForm.getFieldValidator('notes'),
                onSubmit: zodForm.getFieldValidator('notes'),
              }}
            >
              {(field) => (
                <Textarea
                  label='メモ'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    zodForm.getChangeHandler(field.handleChange)(event.currentTarget.value)
                  }
                  error={field.state.meta.errors[0]}
                  minRows={3}
                  disabled={!canEdit}
                />
              )}
            </form.Field>

            {canEdit ? (
              <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                  <Group justify='flex-end'>
                    <Button
                      type='submit'
                      disabled={!canSubmit}
                      loading={submitting || Boolean(isSubmitting)}
                    >
                      保存
                    </Button>
                  </Group>
                )}
              </form.Subscribe>
            ) : null}
          </Stack>
        </form>
      </Stack>
    </Card>
  );
}

export function TeamDetailPage({ tournamentId, teamId }: TeamDetailPageProps) {
  const { data: session } = useAuthSession();
  const canEdit = canEditTeamResources(session, teamId);
  const ownTeam = isOwnTeam(session, teamId);
  const canSeePrivateFields = canViewTeamPrivateFields(session, teamId);
  const [includeArchived, { toggle: toggleArchived }] = useDisclosure(false);
  const teamQuery = useTeam(teamId);
  const wifiConfigsQuery = useTeamWifiConfigs(teamId);
  const deviceSpecsQuery = useTeamDeviceSpecs(teamId, includeArchived);
  const bestPracticesQuery = useTournamentBestPractices(tournamentId);
  const issueReportsQuery = useTournamentIssueReports(tournamentId);
  const updateTeamMutation = useUpdateTeamMutation(teamId, tournamentId);
  const createWifiConfigMutation = useCreateWifiConfigMutation(teamId);
  const updateWifiConfigMutation = useUpdateWifiConfigMutation(teamId);
  const disableWifiConfigMutation = useDisableWifiConfigMutation(teamId);
  const createDeviceSpecMutation = useCreateDeviceSpecMutation(teamId, includeArchived);
  const updateDeviceSpecMutation = useUpdateDeviceSpecMutation(teamId, includeArchived);
  const archiveDeviceSpecMutation = useArchiveDeviceSpecMutation(teamId, includeArchived);
  const [editingWifiId, setEditingWifiId] = useState<string | 'new' | null>(null);
  const [editingDeviceId, setEditingDeviceId] = useState<string | 'new' | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const wifiConfigs = wifiConfigsQuery.data ?? [];
  const deviceSpecs = deviceSpecsQuery.data ?? [];
  const team = teamQuery.data;
  const editingWifi =
    editingWifiId && editingWifiId !== 'new'
      ? wifiConfigs.find((config) => config.id === editingWifiId)
      : undefined;
  const editingDevice =
    editingDeviceId && editingDeviceId !== 'new'
      ? deviceSpecs.find((spec) => spec.id === editingDeviceId)
      : undefined;
  const issueReports = useMemo(
    () =>
      (issueReportsQuery.data ?? []).filter(
        (report) => report.teamId === teamId && (ownTeam || report.visibility === 'team_public'),
      ),
    [issueReportsQuery.data, ownTeam, teamId],
  );
  const localIssueReportSyncQuery = useQuery({
    queryKey: ['local-sync', 'issue-report', tournamentId, teamId],
    queryFn: () =>
      listIssueReportSyncRecords({
        tournamentId,
        teamId,
        statuses: ['pending', 'processing', 'failed'],
      }),
    enabled: ownTeam,
  });

  if (
    teamQuery.isLoading ||
    wifiConfigsQuery.isLoading ||
    deviceSpecsQuery.isLoading ||
    issueReportsQuery.isLoading
  ) {
    return (
      <Stack align='center' py='xl'>
        <Loader color='teal' />
        <Text c='dimmed'>チーム詳細を読み込んでいます</Text>
      </Stack>
    );
  }

  if (!team || teamQuery.isError) {
    return (
      <Alert color='red' title='チームを取得できませんでした'>
        権限不足、または対象チームが存在しない可能性があります。
      </Alert>
    );
  }

  return (
    <Stack gap='lg'>
      <Group justify='space-between' align='flex-start'>
        <div>
          <Title order={2}>{team.name}</Title>
          <Text c='dimmed'>
            {ownTeam ? '自チーム' : '他チーム'} / {canEdit ? '編集権限あり' : '閲覧専用'}
          </Text>
        </div>
        <Group>
          <Button component={Link} to={`/tournaments/${tournamentId}/teams`} variant='subtle'>
            一覧へ戻る
          </Button>
          <Badge color={canEdit ? 'teal' : 'gray'} variant='light'>
            active + standby {countActiveWifiConfigs(wifiConfigs)} 件
          </Badge>
        </Group>
      </Group>

      {submitMessage ? (
        <Alert color='teal' variant='light'>
          {submitMessage}
        </Alert>
      ) : null}
      {submitError ? (
        <Alert color='red' variant='light'>
          {submitError}
        </Alert>
      ) : null}

      {!canEdit ? (
        <Alert color='blue' variant='light'>
          この画面は閲覧専用です。編集 UI は自チーム editor または運営者にのみ表示されます。
        </Alert>
      ) : null}

      <TeamEditorSection
        team={team}
        canEdit={canEdit}
        canSeePrivateFields={canSeePrivateFields}
        saving={updateTeamMutation.isPending}
        onSubmit={async (values) => {
          setSubmitError(null);
          const parsed = parseTeamFormValues(values);
          if (!parsed.data) {
            return;
          }
          try {
            await updateTeamMutation.mutateAsync(toTeamUpdateInput(parsed.data));
            setSubmitMessage('チーム情報を更新しました。');
          } catch (error) {
            setSubmitError(
              error instanceof Error ? error.message : 'チーム情報の更新に失敗しました',
            );
          }
        }}
      />

      <Divider label='報告一覧' labelPosition='left' />

      {!ownTeam ? (
        <Alert color='blue' variant='light'>
          公開サマリのみ表示しています。
        </Alert>
      ) : null}

      {ownTeam && (localIssueReportSyncQuery.data?.length ?? 0) > 0 ? (
        <Card className='feature-card' padding='lg' radius='xl'>
          <Stack gap='md'>
            <div>
              <Title order={4}>未同期のローカル報告</Title>
              <Text c='dimmed'>
                オフライン保存された pending / failed 報告をここから再確認できます。
              </Text>
            </div>

            {localIssueReportSyncQuery.data?.map((record) => (
              <Card key={record.id} withBorder>
                <Stack gap='xs'>
                  <Group justify='space-between'>
                    <div>
                      <Text fw={700}>
                        {record.payload.symptom} / {record.payload.severity}
                      </Text>
                      <Text size='sm' c='dimmed'>
                        {record.payload.band} / CH {record.payload.channel}
                      </Text>
                    </div>
                    <Badge color={record.status === 'failed' ? 'red' : 'orange'} variant='light'>
                      {record.status}
                    </Badge>
                  </Group>
                  {record.payload.description ? (
                    <Text size='sm'>{record.payload.description}</Text>
                  ) : null}
                  <Group justify='flex-end'>
                    <Button
                      component={Link}
                      size='xs'
                      variant='light'
                      to={`/tournaments/${tournamentId}/issue-reports/${record.entityId}`}
                    >
                      未同期報告を開く
                    </Button>
                  </Group>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Card>
      ) : null}

      <Stack gap='md'>
        {issueReports.map((report) => (
          <Card key={report.id} className='feature-card' padding='lg' radius='xl'>
            <Stack gap='xs'>
              <Group justify='space-between'>
                <Title order={4}>
                  {report.symptom} / {report.severity}
                </Title>
                <Badge
                  color={report.visibility === 'team_public' ? 'teal' : 'gray'}
                  variant='light'
                >
                  {report.visibility}
                </Badge>
              </Group>
              <Text size='sm'>
                {report.band} / CH {report.channel}
                {report.channelWidthMHz ? ` / ${report.channelWidthMHz}MHz` : ''}
              </Text>
              {report.apDeviceModel ? <Text size='sm'>AP: {report.apDeviceModel}</Text> : null}
              {report.clientDeviceModel ? (
                <Text size='sm'>Client: {report.clientDeviceModel}</Text>
              ) : null}
              {report.avgPingMs != null ? (
                <Text size='sm'>平均 Ping: {report.avgPingMs} ms</Text>
              ) : null}
              {report.packetLossPercent != null ? (
                <Text size='sm'>Packet loss: {report.packetLossPercent}%</Text>
              ) : null}
              {ownTeam && isDetailedIssueReport(report) && report.reporterName ? (
                <Text size='sm'>報告者: {report.reporterName}</Text>
              ) : null}
              {ownTeam && isDetailedIssueReport(report) && report.locationLabel ? (
                <Text size='sm'>場所: {report.locationLabel}</Text>
              ) : null}
              {ownTeam && isDetailedIssueReport(report) && report.description ? (
                <Text size='sm'>詳細: {report.description}</Text>
              ) : null}
              <Group justify='flex-end'>
                <Button
                  component={Link}
                  size='xs'
                  variant='light'
                  to={`/tournaments/${tournamentId}/issue-reports/${report.id}`}
                >
                  詳細を見る
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
        {issueReports.length === 0 ? (
          <Alert color='gray' variant='light'>
            このチームに紐づく報告はまだありません。
          </Alert>
        ) : null}
      </Stack>

      <Divider label='WiFi 構成' labelPosition='left' />

      <Grid>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap='md'>
            {wifiConfigs.map((config) => {
              const hasSensitiveFields = hasWifiPrivateFields(config);
              return (
                <Card key={config.id} className='feature-card' padding='lg' radius='xl'>
                  <Stack gap='xs'>
                    <Group justify='space-between'>
                      <div>
                        <Title order={4}>{config.name}</Title>
                        <Text c='dimmed'>
                          {config.band} / CH {config.channel} / {config.channelWidthMHz}MHz
                        </Text>
                      </div>
                      <Badge
                        color={
                          config.status === 'active'
                            ? 'teal'
                            : config.status === 'standby'
                              ? 'yellow'
                              : 'gray'
                        }
                        variant='light'
                      >
                        {config.status}
                      </Badge>
                    </Group>
                    <Text size='sm'>
                      用途: {config.purpose} / 役割: {config.role}
                    </Text>
                    {hasSensitiveFields && config.pingTargetIp ? (
                      <Text size='sm'>Ping 監視先: {config.pingTargetIp}</Text>
                    ) : null}
                    {hasSensitiveFields && config.notes ? (
                      <Text size='sm'>{config.notes}</Text>
                    ) : null}
                    <Group>
                      {canEdit ? (
                        <>
                          <Button variant='light' onClick={() => setEditingWifiId(config.id)}>
                            編集
                          </Button>
                          <Button
                            variant='subtle'
                            color='red'
                            loading={
                              disableWifiConfigMutation.isPending && editingWifiId === config.id
                            }
                            onClick={async () => {
                              setSubmitError(null);
                              try {
                                await disableWifiConfigMutation.mutateAsync(config.id);
                                setSubmitMessage('WiFi 構成を無効化しました。');
                              } catch (error) {
                                setSubmitError(
                                  error instanceof Error
                                    ? error.message
                                    : 'WiFi 構成の無効化に失敗しました',
                                );
                              }
                            }}
                          >
                            無効化
                          </Button>
                        </>
                      ) : null}
                    </Group>
                  </Stack>
                </Card>
              );
            })}
            {wifiConfigs.length === 0 ? (
              <Alert color='gray' variant='light'>
                WiFi 構成はまだ登録されていません。
              </Alert>
            ) : null}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          {canEdit ? (
            editingWifiId ? (
              <WifiConfigEditorSection
                initialValues={buildWifiConfigFormValues(editingWifi)}
                configs={wifiConfigs}
                deviceSpecs={deviceSpecs.filter(
                  (spec) => !('archivedAt' in spec) || spec.archivedAt == null,
                )}
                canEdit={canEdit}
                {...(editingWifi ? { editingId: editingWifi.id } : {})}
                bestPractices={bestPracticesQuery.data ?? []}
                onCancel={() => setEditingWifiId(null)}
                submitting={
                  createWifiConfigMutation.isPending || updateWifiConfigMutation.isPending
                }
                onSubmit={async (values) => {
                  setSubmitError(null);
                  const parsed = parseWifiConfigFormValues(values, wifiConfigs, editingWifi?.id);
                  if (!parsed.data) {
                    return;
                  }
                  try {
                    if (editingWifi) {
                      await updateWifiConfigMutation.mutateAsync({
                        id: editingWifi.id,
                        input: toWifiConfigUpdateInput(parsed.data),
                      });
                      setSubmitMessage('WiFi 構成を更新しました。');
                    } else {
                      await createWifiConfigMutation.mutateAsync(toWifiConfigInput(parsed.data));
                      setSubmitMessage('WiFi 構成を追加しました。');
                    }
                    setEditingWifiId(null);
                  } catch (error) {
                    setSubmitError(
                      error instanceof Error ? error.message : 'WiFi 構成の保存に失敗しました',
                    );
                  }
                }}
              />
            ) : (
              <Card className='feature-card' padding='lg' radius='xl'>
                <Stack gap='md'>
                  <Title order={4}>WiFi 構成操作</Title>
                  <Text c='dimmed'>
                    最大 3 件まで登録できます。active / standby の合計で上限判定します。
                  </Text>
                  <Button onClick={() => setEditingWifiId('new')}>新しい WiFi 構成を追加</Button>
                </Stack>
              </Card>
            )
          ) : null}
        </Grid.Col>
      </Grid>

      <Divider label='機材仕様' labelPosition='left' />

      <Group justify='space-between'>
        <Text c='dimmed'>既知の注意点は WiFi 構成編集時の補助にも利用します。</Text>
        {canEdit ? (
          <Switch
            label='アーカイブ済みも表示'
            checked={includeArchived}
            onChange={() => toggleArchived()}
          />
        ) : null}
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap='md'>
            {deviceSpecs.map((spec) => (
              <Card key={spec.id} className='feature-card' padding='lg' radius='xl'>
                <Stack gap='xs'>
                  <Group justify='space-between'>
                    <div>
                      <Title order={4}>
                        {spec.vendor ? `${spec.vendor} ${spec.model}` : spec.model}
                      </Title>
                      <Text c='dimmed'>
                        {spec.kind} / {spec.supportedBands.join(', ')}
                      </Text>
                    </div>
                    {hasDevicePrivateFields(spec) && spec.archivedAt ? (
                      <Badge color='gray' variant='light'>
                        archived
                      </Badge>
                    ) : null}
                  </Group>
                  {spec.knownIssues ? (
                    <Text size='sm'>既知の注意点: {spec.knownIssues}</Text>
                  ) : null}
                  {hasDevicePrivateFields(spec) && spec.notes ? (
                    <Text size='sm'>{spec.notes}</Text>
                  ) : null}
                  {canEdit ? (
                    <Group>
                      <Button variant='light' onClick={() => setEditingDeviceId(spec.id)}>
                        編集
                      </Button>
                      {!hasDevicePrivateFields(spec) || !spec.archivedAt ? (
                        <Button
                          variant='subtle'
                          color='red'
                          loading={
                            archiveDeviceSpecMutation.isPending && editingDeviceId === spec.id
                          }
                          onClick={async () => {
                            setSubmitError(null);
                            try {
                              await archiveDeviceSpecMutation.mutateAsync(spec.id);
                              setSubmitMessage('機材仕様をアーカイブしました。');
                            } catch (error) {
                              setSubmitError(
                                error instanceof Error
                                  ? error.message
                                  : '機材仕様のアーカイブに失敗しました',
                              );
                            }
                          }}
                        >
                          アーカイブ
                        </Button>
                      ) : null}
                    </Group>
                  ) : null}
                </Stack>
              </Card>
            ))}
            {deviceSpecs.length === 0 ? (
              <Alert color='gray' variant='light'>
                機材仕様はまだ登録されていません。
              </Alert>
            ) : null}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          {canEdit ? (
            editingDeviceId ? (
              <DeviceSpecEditorSection
                initialValues={buildDeviceSpecFormValues(editingDevice)}
                canEdit={canEdit}
                onCancel={() => setEditingDeviceId(null)}
                submitting={
                  createDeviceSpecMutation.isPending || updateDeviceSpecMutation.isPending
                }
                onSubmit={async (values) => {
                  setSubmitError(null);
                  const parsed = parseDeviceSpecFormValues(values);
                  if (!parsed.data) {
                    return;
                  }
                  try {
                    if (editingDevice) {
                      await updateDeviceSpecMutation.mutateAsync({
                        id: editingDevice.id,
                        input: toDeviceSpecUpdateInput(parsed.data),
                      });
                      setSubmitMessage('機材仕様を更新しました。');
                    } else {
                      await createDeviceSpecMutation.mutateAsync(toDeviceSpecInput(parsed.data));
                      setSubmitMessage('機材仕様を追加しました。');
                    }
                    setEditingDeviceId(null);
                  } catch (error) {
                    setSubmitError(
                      error instanceof Error ? error.message : '機材仕様の保存に失敗しました',
                    );
                  }
                }}
              />
            ) : (
              <Card className='feature-card' padding='lg' radius='xl'>
                <Stack gap='md'>
                  <Title order={4}>機材仕様操作</Title>
                  <Text c='dimmed'>
                    WiFi 編集候補に紐づくため、AP とクライアントを先に登録しておくと便利です。
                  </Text>
                  <Button onClick={() => setEditingDeviceId('new')}>新しい機材仕様を追加</Button>
                </Stack>
              </Card>
            )
          ) : null}
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
