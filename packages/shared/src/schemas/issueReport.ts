import { z } from 'zod';
import {
  BANDS,
  DISTANCE_CATEGORIES,
  ISSUE_REPORT_VISIBILITIES,
  MITIGATIONS,
  REPRODUCIBILITIES,
  SEVERITIES,
  SYMPTOMS,
} from '../enums.js';
import { DateTimeStringSchema, optionalFromNullable } from './common.js';

export const IssueReportAttachmentSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(2000).optional(),
  mimeType: z.string().max(200).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export const IssueReportSchema = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid(),
  teamId: optionalFromNullable(z.string().uuid()),
  wifiConfigId: optionalFromNullable(z.string().uuid()),
  reporterName: optionalFromNullable(z.string().max(200)),
  visibility: z.enum(ISSUE_REPORT_VISIBILITIES),
  band: z.enum(BANDS),
  channel: z.number().int().positive(),
  channelWidthMHz: optionalFromNullable(z.number().int().positive()),
  symptom: z.enum(SYMPTOMS),
  severity: z.enum(SEVERITIES),
  avgPingMs: optionalFromNullable(z.number().nonnegative()),
  maxPingMs: optionalFromNullable(z.number().nonnegative()),
  packetLossPercent: optionalFromNullable(z.number().min(0).max(100)),
  distanceCategory: optionalFromNullable(z.enum(DISTANCE_CATEGORIES)),
  estimatedDistanceMeters: optionalFromNullable(z.number().nonnegative()),
  locationLabel: optionalFromNullable(z.string().max(200)),
  reproducibility: optionalFromNullable(z.enum(REPRODUCIBILITIES)),
  description: optionalFromNullable(z.string().max(5000)),
  mitigationTried: optionalFromNullable(z.array(z.enum(MITIGATIONS))),
  improved: optionalFromNullable(z.boolean()),
  attachments: optionalFromNullable(z.array(IssueReportAttachmentSchema).max(10)),
  apDeviceModel: optionalFromNullable(z.string().max(200)),
  clientDeviceModel: optionalFromNullable(z.string().max(200)),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const PublicIssueReportSummarySchema = IssueReportSchema.pick({
  id: true,
  tournamentId: true,
  teamId: true,
  wifiConfigId: true,
  visibility: true,
  band: true,
  channel: true,
  channelWidthMHz: true,
  symptom: true,
  severity: true,
  avgPingMs: true,
  maxPingMs: true,
  packetLossPercent: true,
  distanceCategory: true,
  estimatedDistanceMeters: true,
  reproducibility: true,
  mitigationTried: true,
  improved: true,
  apDeviceModel: true,
  clientDeviceModel: true,
  createdAt: true,
  updatedAt: true,
});

export const CreateIssueReportBaseSchema = z.object({
  tournamentId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  wifiConfigId: z.string().uuid().optional(),
  reporterName: z.string().max(200).optional(),
  visibility: z.enum(ISSUE_REPORT_VISIBILITIES).default('team_private'),
  band: z.enum(BANDS).optional(),
  channel: z.number().int().positive().optional(),
  channelWidthMHz: z.number().int().positive().optional(),
  symptom: z.enum(SYMPTOMS),
  severity: z.enum(SEVERITIES),
  avgPingMs: z.number().nonnegative().optional(),
  maxPingMs: z.number().nonnegative().optional(),
  packetLossPercent: z.number().min(0).max(100).optional(),
  distanceCategory: z.enum(DISTANCE_CATEGORIES).optional(),
  estimatedDistanceMeters: z.number().nonnegative().optional(),
  locationLabel: z.string().max(200).optional(),
  reproducibility: z.enum(REPRODUCIBILITIES).optional(),
  description: z.string().max(5000).optional(),
  mitigationTried: z.array(z.enum(MITIGATIONS)).optional(),
  improved: z.boolean().optional(),
  attachments: z.array(IssueReportAttachmentSchema).max(10).optional(),
  apDeviceModel: z.string().max(200).optional(),
  clientDeviceModel: z.string().max(200).optional(),
});

// 簡易モード: 必須項目のみ
export const CreateIssueReportSchema = CreateIssueReportBaseSchema.superRefine((value, ctx) => {
  if (value.wifiConfigId) return;
  if (!value.band) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['band'],
      message: 'wifiConfigId を指定しない場合は band が必要です',
    });
  }
  if (value.channel === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['channel'],
      message: 'wifiConfigId を指定しない場合は channel が必要です',
    });
  }
});

export const UpdateIssueReportSchema = z.object({
  teamId: z.string().uuid().optional(),
  wifiConfigId: z.string().uuid().optional(),
  reporterName: z.string().max(200).nullable().optional(),
  visibility: z.enum(ISSUE_REPORT_VISIBILITIES).optional(),
  band: z.enum(BANDS).optional(),
  channel: z.number().int().positive().optional(),
  channelWidthMHz: z.number().int().positive().optional(),
  symptom: z.enum(SYMPTOMS).optional(),
  severity: z.enum(SEVERITIES).optional(),
  avgPingMs: z.number().nonnegative().nullable().optional(),
  maxPingMs: z.number().nonnegative().nullable().optional(),
  packetLossPercent: z.number().min(0).max(100).nullable().optional(),
  distanceCategory: z.enum(DISTANCE_CATEGORIES).nullable().optional(),
  estimatedDistanceMeters: z.number().nonnegative().nullable().optional(),
  locationLabel: z.string().max(200).nullable().optional(),
  reproducibility: z.enum(REPRODUCIBILITIES).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  mitigationTried: z.array(z.enum(MITIGATIONS)).nullable().optional(),
  improved: z.boolean().nullable().optional(),
  attachments: z.array(IssueReportAttachmentSchema).max(10).nullable().optional(),
  apDeviceModel: z.string().max(200).nullable().optional(),
  clientDeviceModel: z.string().max(200).nullable().optional(),
});

export type IssueReportAttachment = z.infer<typeof IssueReportAttachmentSchema>;
export type IssueReport = z.infer<typeof IssueReportSchema>;
export type PublicIssueReportSummary = z.infer<typeof PublicIssueReportSummarySchema>;
export type CreateIssueReport = z.infer<typeof CreateIssueReportSchema>;
export type UpdateIssueReport = z.infer<typeof UpdateIssueReportSchema>;
