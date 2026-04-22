import { describe, expect, it } from 'vitest';
import {
  CreateIssueReportSchema,
  PublicIssueReportSummarySchema,
  UpdateIssueReportSchema,
} from '../../src/schemas/issueReport.js';

describe('CreateIssueReportSchema', () => {
  it('wifiConfigId がある場合は帯域とチャンネルを自動補完前提で省略できる', () => {
    const result = CreateIssueReportSchema.safeParse({
      tournamentId: '00000000-0000-4000-8000-000000000001',
      wifiConfigId: '00000000-0000-4000-8000-000000000031',
      symptom: 'high_latency',
      severity: 'medium',
      attachments: [
        {
          name: 'ping-log.csv',
          mimeType: 'text/csv',
          sizeBytes: 2048,
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visibility).toBe('team_private');
      expect(result.data.band).toBeUndefined();
      expect(result.data.channel).toBeUndefined();
    }
  });

  it('wifiConfigId がない場合は帯域とチャンネルが必須', () => {
    const result = CreateIssueReportSchema.safeParse({
      tournamentId: '00000000-0000-4000-8000-000000000001',
      symptom: 'high_latency',
      severity: 'medium',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(['band', 'channel']);
    }
  });
});

describe('UpdateIssueReportSchema', () => {
  it('追記項目を null でクリアできる', () => {
    const result = UpdateIssueReportSchema.safeParse({
      reporterName: null,
      avgPingMs: null,
      maxPingMs: null,
      packetLossPercent: null,
      distanceCategory: null,
      estimatedDistanceMeters: null,
      reproducibility: null,
      locationLabel: null,
      description: null,
      mitigationTried: null,
      improved: null,
      attachments: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        reporterName: null,
        avgPingMs: null,
        maxPingMs: null,
        packetLossPercent: null,
        distanceCategory: null,
        estimatedDistanceMeters: null,
        reproducibility: null,
        locationLabel: null,
        description: null,
        mitigationTried: null,
        improved: null,
        attachments: null,
      });
    }
  });
});

describe('PublicIssueReportSummarySchema', () => {
  it('公開サマリでは mitigationTried を受け付けない', () => {
    const result = PublicIssueReportSummarySchema.safeParse({
      id: '00000000-0000-4000-8000-000000000011',
      tournamentId: '00000000-0000-4000-8000-000000000001',
      teamId: '00000000-0000-4000-8000-000000000021',
      wifiConfigId: null,
      visibility: 'team_public',
      band: '5GHz',
      channel: 36,
      channelWidthMHz: 80,
      symptom: 'high_latency',
      severity: 'medium',
      avgPingMs: null,
      maxPingMs: null,
      packetLossPercent: null,
      distanceCategory: null,
      estimatedDistanceMeters: null,
      reproducibility: null,
      mitigationTried: ['change_channel'],
      improved: null,
      apDeviceModel: null,
      clientDeviceModel: null,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('mitigationTried');
    }
  });
});
