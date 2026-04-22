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
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  DISTANCE_CATEGORIES,
  ISSUE_REPORT_VISIBILITIES,
  MITIGATIONS,
  REPRODUCIBILITIES,
} from "@wifiman/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient, type IssueReportView } from "../lib/api/client.js";
import { canEditTeamResources } from "../lib/authz.js";
import {
  findIssueReportSyncRecord,
  updateIssueReportSyncPayload,
  updateSyncRecordAfterAttempt,
} from "../lib/db/appDb.js";
import {
  applyIssueReportPatchToCreatePayload,
  buildIssueReportPatchFormValues,
  createEmptyIssueReportAttachment,
  type IssueReportPatchFormValues,
  issueReportPatchFormSchema,
  toValidatedIssueReportPatchInput,
} from "../lib/issueReportForm.js";
import {
  createTanStackFormZodHelpers,
  getSubmitErrorMessage,
} from "../lib/tanstackFormZod.js";
import { useAuthSession } from "../lib/useAuthSession.js";
import {
  useIssueReport,
  useUpdateIssueReportMutation,
} from "../lib/useTeamManagement.js";

type IssueReportDetailPageProps = {
  tournamentId: string;
  issueReportId: string;
};

export function IssueReportDetailPage({
  tournamentId,
  issueReportId,
}: IssueReportDetailPageProps) {
  const navigate = useNavigate();
  const { data: session } = useAuthSession();
  const issueReportQuery = useIssueReport(issueReportId);
  const localSyncQuery = useQuery({
    queryKey: ["local-sync", "issue-report", issueReportId],
    queryFn: () => findIssueReportSyncRecord(issueReportId),
    retry: false,
  });
  const updateIssueReportMutation = useUpdateIssueReportMutation(
    issueReportId,
    tournamentId,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitModeRef = useRef<"save" | "resend">("save");
  const zodFormHelpers = useMemo(
    () =>
      createTanStackFormZodHelpers(
        issueReportPatchFormSchema,
        setSubmitError,
        "報告の更新に失敗しました",
      ),
    [],
  );
  const resolvedReport = issueReportQuery.data ?? null;
  const localRecord = localSyncQuery.data;

  const effectiveTeamId =
    resolvedReport?.teamId ?? localRecord?.payload.teamId ?? "";
  const canEdit = Boolean(
    effectiveTeamId && canEditTeamResources(session, effectiveTeamId),
  );
  const syncStatus = localRecord?.status ?? "server_synced";
  const syncBadgeColor =
    syncStatus === "failed"
      ? "red"
      : syncStatus === "pending"
        ? "orange"
        : "teal";
  const sourcePayload = localRecord?.payload;
  const displayReport = useMemo(() => {
    if (resolvedReport) {
      return resolvedReport;
    }

    if (!sourcePayload || !localRecord) {
      return null;
    }

    return {
      id: issueReportId,
      tournamentId: localRecord.tournamentId,
      teamId: sourcePayload.teamId ?? null,
      wifiConfigId: sourcePayload.wifiConfigId ?? null,
      reporterName: sourcePayload.reporterName ?? null,
      visibility: sourcePayload.visibility ?? "team_private",
      band: sourcePayload.band ?? "5GHz",
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
      createdAt: localRecord.createdAt,
      updatedAt: localRecord.updatedAt,
    } satisfies IssueReportView;
  }, [issueReportId, localRecord, resolvedReport, sourcePayload]);
  const initialValues = useMemo(
    () => buildIssueReportPatchFormValues(resolvedReport, localRecord?.payload),
    [localRecord?.payload, resolvedReport],
  );
  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      zodFormHelpers.clearSubmitError();
      const patch = toValidatedIssueReportPatchInput(value);

      if (submitModeRef.current === "resend") {
        if (!localRecord) {
          return;
        }

        await updateSyncRecordAfterAttempt(localRecord.id, {
          status: "processing",
        });

        try {
          const created = await apiClient.createIssueReport(
            tournamentId,
            applyIssueReportPatchToCreatePayload(localRecord.payload, patch),
          );

          await updateSyncRecordAfterAttempt(localRecord.id, {
            status: "done",
            entityId: created.id,
          });

          notifications.show({
            color: "teal",
            title: "再送しました",
            message: "同期状態を更新しました。",
          });

          await navigate({
            to: `/tournaments/${tournamentId}/issue-reports/${created.id}`,
          });
          return;
        } catch (error) {
          await updateSyncRecordAfterAttempt(localRecord.id, {
            status: "failed",
            errorMessage: getSubmitErrorMessage(error, "failed to resend"),
          });
          setSubmitError(getSubmitErrorMessage(error, "再送に失敗しました"));
          return;
        }
      }

      try {
        if (localRecord) {
          await updateIssueReportSyncPayload(localRecord.id, patch);
        } else {
          await updateIssueReportMutation.mutateAsync(patch);
        }

        notifications.show({
          color: "teal",
          title: "報告を更新しました",
          message: localRecord
            ? "ローカル保存内容を更新しました。"
            : "追記内容を保存しました。",
        });
      } catch (error) {
        setSubmitError(
          getSubmitErrorMessage(error, "報告の更新に失敗しました"),
        );
      }
    },
  });

  useEffect(() => {
    form.reset(initialValues);
    zodFormHelpers.clearSubmitError();
  }, [form, initialValues, zodFormHelpers]);

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

  return (
    <Card className='form-card' padding='xl' radius='xl'>
      <Stack gap='lg'>
        <Group justify='space-between' align='flex-start'>
          <div>
            <Title order={2}>不具合報告詳細</Title>
            <Text c='dimmed'>
              同期状態、公開範囲、追記内容をここで確認・更新します。
            </Text>
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
          <TextInput
            label='チャンネル'
            value={String(displayReport.channel)}
            readOnly
          />
          <TextInput
            label='帯域幅 (MHz)'
            value={
              displayReport.channelWidthMHz
                ? String(displayReport.channelWidthMHz)
                : ""
            }
            readOnly
          />
        </Group>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            zodFormHelpers.handleSubmitInvalid();
            void form.handleSubmit();
          }}
        >
          <form.Subscribe
            selector={(state) => ({
              values: state.values,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ values, isSubmitting }) => {
              const handleFieldChange = <T,>(
                handleChange: (value: T) => void,
                nextValue: T,
              ) => {
                zodFormHelpers.clearSubmitError();
                handleChange(nextValue);
              };

              return (
                <Stack gap='md'>
                  <Group grow align='flex-start'>
                    <form.Field
                      name='visibility'
                      validators={{
                        onSubmit:
                          zodFormHelpers.getFieldValidator("visibility"),
                      }}
                    >
                      {(field) => (
                        <NativeSelect
                          label='公開範囲'
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          disabled={!canEdit}
                          data={ISSUE_REPORT_VISIBILITIES.map((entry) => ({
                            value: entry,
                            label: entry,
                          }))}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            handleFieldChange(
                              field.handleChange,
                              event.currentTarget.value,
                            );
                          }}
                        />
                      )}
                    </form.Field>

                    <form.Field
                      name='reporterName'
                      validators={{
                        onChange:
                          zodFormHelpers.getFieldValidator("reporterName"),
                        onSubmit:
                          zodFormHelpers.getFieldValidator("reporterName"),
                      }}
                    >
                      {(field) => (
                        <TextInput
                          label='報告者名'
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          disabled={!canEdit}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            handleFieldChange(
                              field.handleChange,
                              event.currentTarget.value,
                            );
                          }}
                        />
                      )}
                    </form.Field>
                  </Group>

                  <Group grow align='flex-start'>
                    <form.Field
                      name='avgPingMs'
                      validators={{
                        onChange: zodFormHelpers.getFieldValidator("avgPingMs"),
                        onSubmit: zodFormHelpers.getFieldValidator("avgPingMs"),
                      }}
                    >
                      {(field) => (
                        <NumberInput
                          label='平均 Ping (ms)'
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          disabled={!canEdit}
                          min={0}
                          onBlur={field.handleBlur}
                          onChange={(value) => {
                            handleFieldChange(
                              field.handleChange,
                              typeof value === "number" ? value : "",
                            );
                          }}
                        />
                      )}
                    </form.Field>

                    <form.Field
                      name='maxPingMs'
                      validators={{
                        onChange: zodFormHelpers.getFieldValidator("maxPingMs"),
                        onSubmit: zodFormHelpers.getFieldValidator("maxPingMs"),
                      }}
                    >
                      {(field) => (
                        <NumberInput
                          label='最大 Ping (ms)'
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          disabled={!canEdit}
                          min={0}
                          onBlur={field.handleBlur}
                          onChange={(value) => {
                            handleFieldChange(
                              field.handleChange,
                              typeof value === "number" ? value : "",
                            );
                          }}
                        />
                      )}
                    </form.Field>

                    <form.Field
                      name='packetLossPercent'
                      validators={{
                        onChange:
                          zodFormHelpers.getFieldValidator("packetLossPercent"),
                        onSubmit:
                          zodFormHelpers.getFieldValidator("packetLossPercent"),
                      }}
                    >
                      {(field) => (
                        <NumberInput
                          label='パケットロス率 (%)'
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          disabled={!canEdit}
                          min={0}
                          max={100}
                          onBlur={field.handleBlur}
                          onChange={(value) => {
                            handleFieldChange(
                              field.handleChange,
                              typeof value === "number" ? value : "",
                            );
                          }}
                        />
                      )}
                    </form.Field>
                  </Group>

                  <Group grow align='flex-start'>
                    <form.Field
                      name='distanceCategory'
                      validators={{
                        onChange:
                          zodFormHelpers.getFieldValidator("distanceCategory"),
                        onSubmit:
                          zodFormHelpers.getFieldValidator("distanceCategory"),
                      }}
                    >
                      {(field) => (
                        <NativeSelect
                          label='距離カテゴリ'
                          disabled={!canEdit}
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          data={[
                            { value: "", label: "未選択" },
                            ...DISTANCE_CATEGORIES.map((entry) => ({
                              value: entry,
                              label: entry,
                            })),
                          ]}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            handleFieldChange(
                              field.handleChange,
                              event.currentTarget.value,
                            );
                          }}
                        />
                      )}
                    </form.Field>

                    <form.Field
                      name='estimatedDistanceMeters'
                      validators={{
                        onChange: zodFormHelpers.getFieldValidator(
                          "estimatedDistanceMeters",
                        ),
                        onSubmit: zodFormHelpers.getFieldValidator(
                          "estimatedDistanceMeters",
                        ),
                      }}
                    >
                      {(field) => (
                        <NumberInput
                          label='推定距離[m]'
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          disabled={!canEdit}
                          min={0}
                          onBlur={field.handleBlur}
                          onChange={(value) => {
                            handleFieldChange(
                              field.handleChange,
                              typeof value === "number" ? value : "",
                            );
                          }}
                        />
                      )}
                    </form.Field>

                    <form.Field
                      name='reproducibility'
                      validators={{
                        onChange:
                          zodFormHelpers.getFieldValidator("reproducibility"),
                        onSubmit:
                          zodFormHelpers.getFieldValidator("reproducibility"),
                      }}
                    >
                      {(field) => (
                        <NativeSelect
                          label='再現性'
                          disabled={!canEdit}
                          value={field.state.value}
                          error={field.state.meta.errors[0]}
                          data={[
                            { value: "", label: "未選択" },
                            ...REPRODUCIBILITIES.map((entry) => ({
                              value: entry,
                              label: entry,
                            })),
                          ]}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            handleFieldChange(
                              field.handleChange,
                              event.currentTarget.value,
                            );
                          }}
                        />
                      )}
                    </form.Field>
                  </Group>

                  <form.Field
                    name='locationLabel'
                    validators={{
                      onChange:
                        zodFormHelpers.getFieldValidator("locationLabel"),
                      onSubmit:
                        zodFormHelpers.getFieldValidator("locationLabel"),
                    }}
                  >
                    {(field) => (
                      <TextInput
                        label='観測位置'
                        value={field.state.value}
                        error={field.state.meta.errors[0]}
                        disabled={!canEdit}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          handleFieldChange(
                            field.handleChange,
                            event.currentTarget.value,
                          );
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
                            <Checkbox
                              key={entry}
                              value={entry}
                              label={entry}
                              disabled={!canEdit}
                            />
                          ))}
                        </Group>
                      </Checkbox.Group>
                    )}
                  </form.Field>

                  <form.Field name='improved'>
                    {(field) => (
                      <NativeSelect
                        label='改善有無'
                        disabled={!canEdit}
                        value={field.state.value}
                        error={field.state.meta.errors[0]}
                        data={[
                          { value: "", label: "未選択" },
                          { value: "true", label: "改善した" },
                          { value: "false", label: "改善しない" },
                        ]}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          handleFieldChange(
                            field.handleChange,
                            event.currentTarget
                              .value as IssueReportPatchFormValues["improved"],
                          );
                        }}
                      />
                    )}
                  </form.Field>

                  <form.Field
                    name='attachments'
                    mode='array'
                    validators={{
                      onSubmit: zodFormHelpers.getFieldValidator("attachments"),
                    }}
                  >
                    {(field) => (
                      <Stack gap='sm'>
                        <Group justify='space-between'>
                          <Text fw={700}>添付ファイル</Text>
                          {canEdit ? (
                            <Button
                              type='button'
                              variant='light'
                              size='xs'
                              onClick={() => {
                                zodFormHelpers.clearSubmitError();
                                field.pushValue(
                                  createEmptyIssueReportAttachment(),
                                );
                              }}
                            >
                              添付を追加
                            </Button>
                          ) : null}
                        </Group>

                        {field.state.meta.errors[0] ? (
                          <Text c='red' size='sm'>
                            {field.state.meta.errors[0]}
                          </Text>
                        ) : null}

                        {values.attachments.map((attachment, index) => (
                          <Card
                            key={attachment.id}
                            withBorder
                            radius='md'
                            padding='md'
                          >
                            <Stack gap='sm'>
                              <Group grow align='flex-start'>
                                <form.Field name={`attachments[${index}].name`}>
                                  {(subField) => (
                                    <TextInput
                                      label={`添付ファイル名 ${index + 1}`}
                                      value={subField.state.value}
                                      disabled={!canEdit}
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
                                      disabled={!canEdit}
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
                                <form.Field
                                  name={`attachments[${index}].mimeType`}
                                >
                                  {(subField) => (
                                    <TextInput
                                      label={`MIME type ${index + 1}`}
                                      value={subField.state.value}
                                      disabled={!canEdit}
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

                                <form.Field
                                  name={`attachments[${index}].sizeBytes`}
                                >
                                  {(subField) => (
                                    <NumberInput
                                      label={`サイズ (bytes) ${index + 1}`}
                                      value={subField.state.value}
                                      disabled={!canEdit}
                                      min={0}
                                      onBlur={subField.handleBlur}
                                      onChange={(value) => {
                                        handleFieldChange(
                                          subField.handleChange,
                                          typeof value === "number"
                                            ? value
                                            : "",
                                        );
                                      }}
                                    />
                                  )}
                                </form.Field>
                              </Group>

                              {canEdit ? (
                                <Group justify='flex-end'>
                                  <Button
                                    type='button'
                                    color='red'
                                    variant='subtle'
                                    size='xs'
                                    onClick={() => {
                                      zodFormHelpers.clearSubmitError();
                                      field.removeValue(index);
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
                    )}
                  </form.Field>

                  <form.Field
                    name='description'
                    validators={{
                      onChange: zodFormHelpers.getFieldValidator("description"),
                      onSubmit: zodFormHelpers.getFieldValidator("description"),
                    }}
                  >
                    {(field) => (
                      <Textarea
                        label='自由記述'
                        minRows={5}
                        value={field.state.value}
                        error={field.state.meta.errors[0]}
                        disabled={!canEdit}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          handleFieldChange(
                            field.handleChange,
                            event.currentTarget.value,
                          );
                        }}
                      />
                    )}
                  </form.Field>

                  <Group justify='flex-end'>
                    {localRecord ? (
                      <Button
                        type='submit'
                        color='orange'
                        variant='light'
                        loading={
                          Boolean(isSubmitting) &&
                          submitModeRef.current === "resend"
                        }
                        onClick={() => {
                          submitModeRef.current = "resend";
                        }}
                      >
                        再送
                      </Button>
                    ) : null}
                    {canEdit ? (
                      <Button
                        type='submit'
                        loading={
                          Boolean(isSubmitting) &&
                          submitModeRef.current === "save"
                        }
                        onClick={() => {
                          submitModeRef.current = "save";
                        }}
                      >
                        追記を保存
                      </Button>
                    ) : null}
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
