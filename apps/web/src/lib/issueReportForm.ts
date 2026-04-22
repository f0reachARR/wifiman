import {
  DISTANCE_CATEGORIES,
  ISSUE_REPORT_VISIBILITIES,
  MITIGATIONS,
  REPRODUCIBILITIES,
  SEVERITIES,
  SYMPTOMS,
} from '@wifiman/shared';
import { z } from 'zod';
import type {
  IssueReportCreateInput,
  IssueReportUpdateInput,
  IssueReportView,
} from './api/client.js';

type IssueReportCreateAttachment = NonNullable<
  NonNullable<IssueReportCreateInput['attachments']>[number]
>;

type IssueReportUpdateAttachment = NonNullable<
  NonNullable<IssueReportUpdateInput['attachments']>[number]
>;

export type IssueReportAttachmentDraft = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number | '';
};

export type IssueReportCreateFormValues = {
  wifiConfigId: string;
  reporterName: string;
  visibility: string;
  symptom: string;
  severity: string;
  avgPingMs: number | '';
  packetLossPercent: number | '';
  distanceCategory: string;
  maxPingMs: number | '';
  estimatedDistanceMeters: number | '';
  reproducibility: string;
  locationLabel: string;
  mitigationTried: string[];
  improved: '' | 'true' | 'false';
  description: string;
  attachments: IssueReportAttachmentDraft[];
};

export type IssueReportPatchFormValues = {
  visibility: string;
  reporterName: string;
  avgPingMs: number | '';
  maxPingMs: number | '';
  packetLossPercent: number | '';
  distanceCategory: string;
  estimatedDistanceMeters: number | '';
  reproducibility: string;
  locationLabel: string;
  description: string;
  mitigationTried: string[];
  improved: '' | 'true' | 'false';
  attachments: IssueReportAttachmentDraft[];
};

type SelectedWifiConfigContext = {
  id: string;
  band: NonNullable<IssueReportCreateInput['band']>;
  channel: number;
  channelWidthMHz?: number | null;
};

type CreateIssueReportPayloadContext = {
  teamId: string;
  selectedConfig: SelectedWifiConfigContext;
  selectedApModel: string;
  selectedClientModel: string;
};

const maxLengthMessage = (limit: number) => `${limit} 文字以内で入力してください`;

const optionalTextField = (limit: number) => z.string().trim().max(limit, maxLengthMessage(limit));

const optionalNumberField = (message = '0 以上の値を入力してください') =>
  z.union([z.literal(''), z.number().nonnegative(message)]);

const optionalPercentField = z.union([
  z.literal(''),
  z.number().min(0, '0 以上の値を入力してください').max(100, '100 以下の値を入力してください'),
]);

const requiredSelectionField = (choices: readonly string[], message: string) =>
  z.string().refine((value) => choices.includes(value), message);

const optionalSelectionField = (choices: readonly string[], message: string) =>
  z.string().refine((value) => value.length === 0 || choices.includes(value), message);

const attachmentDraftSchema = z
  .object({
    id: z.string().uuid(),
    name: optionalTextField(200),
    url: z
      .string()
      .trim()
      .max(2000, maxLengthMessage(2000))
      .refine(
        (value) => value.length === 0 || z.string().url().safeParse(value).success,
        '有効な URL を入力してください',
      ),
    mimeType: optionalTextField(200),
    sizeBytes: z.union([
      z.literal(''),
      z.number().int().nonnegative('0 以上の値を入力してください'),
    ]),
  })
  .superRefine((value, ctx) => {
    const hasAnyValue =
      value.name.trim().length > 0 ||
      value.url.trim().length > 0 ||
      value.mimeType.trim().length > 0 ||
      value.sizeBytes !== '';

    if (hasAnyValue && value.name.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: '添付ファイル名を入力してください',
      });
    }
  });

const attachmentArraySchema = z.array(attachmentDraftSchema).max(10, '添付は 10 件までです');

export const issueReportCreateFormSchema = z.object({
  wifiConfigId: z.string().min(1, 'WiFi 構成を選択してください'),
  reporterName: optionalTextField(200),
  visibility: requiredSelectionField(ISSUE_REPORT_VISIBILITIES, '公開範囲を選択してください'),
  symptom: requiredSelectionField(SYMPTOMS, '症状を選択してください'),
  severity: requiredSelectionField(SEVERITIES, '深刻度を選択してください'),
  avgPingMs: optionalNumberField(),
  packetLossPercent: optionalPercentField,
  distanceCategory: optionalSelectionField(DISTANCE_CATEGORIES, '距離カテゴリを選択してください'),
  maxPingMs: optionalNumberField(),
  estimatedDistanceMeters: optionalNumberField(),
  reproducibility: optionalSelectionField(REPRODUCIBILITIES, '再現性を選択してください'),
  locationLabel: optionalTextField(200),
  mitigationTried: z
    .array(z.string().refine((value) => (MITIGATIONS as readonly string[]).includes(value)))
    .max(10),
  improved: z.union([z.literal(''), z.literal('true'), z.literal('false')]),
  description: optionalTextField(5000),
  attachments: attachmentArraySchema,
});

export const issueReportPatchFormSchema = z.object({
  visibility: requiredSelectionField(ISSUE_REPORT_VISIBILITIES, '公開範囲を選択してください'),
  reporterName: optionalTextField(200),
  avgPingMs: optionalNumberField(),
  maxPingMs: optionalNumberField(),
  packetLossPercent: optionalPercentField,
  distanceCategory: optionalSelectionField(DISTANCE_CATEGORIES, '距離カテゴリを選択してください'),
  estimatedDistanceMeters: optionalNumberField(),
  reproducibility: optionalSelectionField(REPRODUCIBILITIES, '再現性を選択してください'),
  locationLabel: optionalTextField(200),
  description: optionalTextField(5000),
  mitigationTried: z
    .array(z.string().refine((value) => (MITIGATIONS as readonly string[]).includes(value)))
    .max(10),
  improved: z.union([z.literal(''), z.literal('true'), z.literal('false')]),
  attachments: attachmentArraySchema,
});

export function createEmptyIssueReportAttachment(): IssueReportAttachmentDraft {
  return {
    id: crypto.randomUUID(),
    name: '',
    url: '',
    mimeType: '',
    sizeBytes: '',
  };
}

export function buildIssueReportCreateFormValues(
  initialWifiConfigId = '',
): IssueReportCreateFormValues {
  return {
    wifiConfigId: initialWifiConfigId,
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
  };
}

function toAttachmentDrafts(
  attachments?: IssueReportCreateAttachment[] | IssueReportUpdateAttachment[] | null,
): IssueReportAttachmentDraft[] {
  return (attachments ?? []).map((attachment) => ({
    id: crypto.randomUUID(),
    name: attachment.name,
    url: attachment.url ?? '',
    mimeType: attachment.mimeType ?? '',
    sizeBytes: attachment.sizeBytes ?? '',
  }));
}

function sanitizeAttachments(
  drafts: IssueReportAttachmentDraft[],
): IssueReportCreateAttachment[] | IssueReportUpdateAttachment[] {
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

function toImprovedValue(value: boolean | null | undefined): '' | 'true' | 'false' {
  if (value == null) {
    return '';
  }

  return value ? 'true' : 'false';
}

function isDetailedReport(report: IssueReportView): report is IssueReportView & {
  reporterName?: string | null;
  locationLabel?: string | null;
  description?: string | null;
  reproducibility?: 'always' | 'sometimes' | 'once' | null;
  maxPingMs?: number | null;
  packetLossPercent?: number | null;
  distanceCategory?: 'near' | 'mid' | 'far' | 'obstacle' | null;
  estimatedDistanceMeters?: number | null;
  mitigationTried?: Array<(typeof MITIGATIONS)[number]> | null;
  improved?: boolean | null;
  attachments?: IssueReportUpdateAttachment[] | null;
} {
  return (
    'reporterName' in report ||
    'locationLabel' in report ||
    'description' in report ||
    'attachments' in report
  );
}

export function buildIssueReportPatchFormValues(
  report: IssueReportView | null,
  localPayload?: IssueReportCreateInput,
): IssueReportPatchFormValues {
  return {
    visibility: report?.visibility ?? localPayload?.visibility ?? 'team_private',
    reporterName:
      report && isDetailedReport(report)
        ? (report.reporterName ?? '')
        : (localPayload?.reporterName ?? ''),
    avgPingMs: report?.avgPingMs ?? localPayload?.avgPingMs ?? '',
    maxPingMs:
      report && isDetailedReport(report)
        ? (report.maxPingMs ?? '')
        : (localPayload?.maxPingMs ?? ''),
    packetLossPercent:
      report && isDetailedReport(report)
        ? (report.packetLossPercent ?? '')
        : (localPayload?.packetLossPercent ?? ''),
    distanceCategory:
      report && isDetailedReport(report)
        ? (report.distanceCategory ?? '')
        : (localPayload?.distanceCategory ?? ''),
    estimatedDistanceMeters:
      report && isDetailedReport(report)
        ? (report.estimatedDistanceMeters ?? '')
        : (localPayload?.estimatedDistanceMeters ?? ''),
    reproducibility:
      report && isDetailedReport(report)
        ? (report.reproducibility ?? '')
        : (localPayload?.reproducibility ?? ''),
    locationLabel:
      report && isDetailedReport(report)
        ? (report.locationLabel ?? '')
        : (localPayload?.locationLabel ?? ''),
    description:
      report && isDetailedReport(report)
        ? (report.description ?? '')
        : (localPayload?.description ?? ''),
    mitigationTried:
      report && isDetailedReport(report)
        ? (report.mitigationTried ?? [])
        : (localPayload?.mitigationTried ?? []),
    improved:
      report && isDetailedReport(report)
        ? toImprovedValue(report.improved)
        : toImprovedValue(localPayload?.improved),
    attachments:
      report && isDetailedReport(report)
        ? toAttachmentDrafts(report.attachments)
        : toAttachmentDrafts(localPayload?.attachments),
  };
}

export function toIssueReportCreatePayload(
  values: IssueReportCreateFormValues,
  context: CreateIssueReportPayloadContext,
): IssueReportCreateInput {
  const attachments = sanitizeAttachments(values.attachments) as IssueReportCreateAttachment[];
  const reporterName = values.reporterName.trim();
  const locationLabel = values.locationLabel.trim();
  const description = values.description.trim();

  return {
    teamId: context.teamId,
    wifiConfigId: context.selectedConfig.id,
    visibility: values.visibility as NonNullable<IssueReportCreateInput['visibility']>,
    symptom: values.symptom as IssueReportCreateInput['symptom'],
    severity: values.severity as IssueReportCreateInput['severity'],
    band: context.selectedConfig.band,
    channel: context.selectedConfig.channel,
    ...(context.selectedConfig.channelWidthMHz
      ? { channelWidthMHz: context.selectedConfig.channelWidthMHz }
      : {}),
    ...(reporterName.length > 0 ? { reporterName } : {}),
    ...(values.avgPingMs !== '' ? { avgPingMs: values.avgPingMs } : {}),
    ...(values.packetLossPercent !== '' ? { packetLossPercent: values.packetLossPercent } : {}),
    ...(values.distanceCategory.length > 0
      ? {
          distanceCategory: values.distanceCategory as NonNullable<
            IssueReportCreateInput['distanceCategory']
          >,
        }
      : {}),
    ...(values.maxPingMs !== '' ? { maxPingMs: values.maxPingMs } : {}),
    ...(values.estimatedDistanceMeters !== ''
      ? { estimatedDistanceMeters: values.estimatedDistanceMeters }
      : {}),
    ...(values.reproducibility.length > 0
      ? {
          reproducibility: values.reproducibility as NonNullable<
            IssueReportCreateInput['reproducibility']
          >,
        }
      : {}),
    ...(locationLabel.length > 0 ? { locationLabel } : {}),
    ...(values.mitigationTried.length > 0
      ? {
          mitigationTried: values.mitigationTried as NonNullable<
            IssueReportCreateInput['mitigationTried']
          >,
        }
      : {}),
    ...(values.improved === 'true' ? { improved: true } : {}),
    ...(values.improved === 'false' ? { improved: false } : {}),
    ...(description.length > 0 ? { description } : {}),
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(context.selectedApModel.length > 0 ? { apDeviceModel: context.selectedApModel } : {}),
    ...(context.selectedClientModel.length > 0
      ? { clientDeviceModel: context.selectedClientModel }
      : {}),
  };
}

export function toIssueReportPatchInput(
  values: IssueReportPatchFormValues,
): IssueReportUpdateInput {
  const attachments = sanitizeAttachments(values.attachments) as IssueReportUpdateAttachment[];
  const reporterName = values.reporterName.trim();
  const locationLabel = values.locationLabel.trim();
  const description = values.description.trim();

  return {
    visibility: values.visibility as NonNullable<IssueReportUpdateInput['visibility']>,
    reporterName: reporterName.length > 0 ? reporterName : null,
    avgPingMs: values.avgPingMs !== '' ? values.avgPingMs : null,
    maxPingMs: values.maxPingMs !== '' ? values.maxPingMs : null,
    packetLossPercent: values.packetLossPercent !== '' ? values.packetLossPercent : null,
    distanceCategory:
      values.distanceCategory.length > 0
        ? (values.distanceCategory as NonNullable<IssueReportUpdateInput['distanceCategory']>)
        : null,
    estimatedDistanceMeters:
      values.estimatedDistanceMeters !== '' ? values.estimatedDistanceMeters : null,
    reproducibility:
      values.reproducibility.length > 0
        ? (values.reproducibility as NonNullable<IssueReportUpdateInput['reproducibility']>)
        : null,
    locationLabel: locationLabel.length > 0 ? locationLabel : null,
    description: description.length > 0 ? description : null,
    mitigationTried:
      values.mitigationTried.length > 0
        ? (values.mitigationTried as NonNullable<IssueReportUpdateInput['mitigationTried']>)
        : null,
    improved: values.improved === '' ? null : values.improved === 'true',
    attachments: attachments.length > 0 ? attachments : null,
  };
}

export function toValidatedIssueReportPatchInput(
  values: IssueReportPatchFormValues,
): IssueReportUpdateInput {
  const validatedValues = issueReportPatchFormSchema.parse(values);

  return toIssueReportPatchInput(validatedValues);
}

export function applyIssueReportPatchToCreatePayload(
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
