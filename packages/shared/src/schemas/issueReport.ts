import { z } from 'zod';
import {
  BANDS,
  DISTANCE_CATEGORIES,
  MITIGATIONS,
  REPRODUCIBILITIES,
  SEVERITIES,
  SYMPTOMS,
  SYNC_STATUSES,
} from '../enums.js';

export const IssueReportSchema = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  wifiConfigId: z.string().uuid().optional(),
  reporterName: z.string().max(200).optional(),
  syncStatus: z.enum(SYNC_STATUSES),
  band: z.enum(BANDS),
  channel: z.number().int().positive(),
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
  apDeviceModel: z.string().max(200).optional(),
  clientDeviceModel: z.string().max(200).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// 簡易モード: 必須項目のみ
export const CreateIssueReportSchema = z.object({
  tournamentId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  wifiConfigId: z.string().uuid().optional(),
  reporterName: z.string().max(200).optional(),
  band: z.enum(BANDS),
  channel: z.number().int().positive(),
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
  apDeviceModel: z.string().max(200).optional(),
  clientDeviceModel: z.string().max(200).optional(),
});

export const UpdateIssueReportSchema = CreateIssueReportSchema.omit({
  tournamentId: true,
}).partial();

export type IssueReport = z.infer<typeof IssueReportSchema>;
export type CreateIssueReport = z.infer<typeof CreateIssueReportSchema>;
export type UpdateIssueReport = z.infer<typeof UpdateIssueReportSchema>;
