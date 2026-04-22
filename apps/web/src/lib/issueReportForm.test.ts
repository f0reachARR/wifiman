import { describe, expect, it, vi } from 'vitest';
import type { IssueReportView } from './api/client.js';
import {
  applyIssueReportPatchToCreatePayload,
  buildIssueReportCreateFormValues,
  buildIssueReportPatchFormValues,
  createEmptyIssueReportAttachment,
  issueReportCreateFormSchema,
  issueReportPatchFormSchema,
  toIssueReportCreatePayload,
  toIssueReportPatchInput,
  toValidatedIssueReportPatchInput,
} from './issueReportForm.js';

describe('issueReportForm', () => {
  it('create schema は symptom と severity を必須にする', () => {
    const parsed = issueReportCreateFormSchema.safeParse(buildIssueReportCreateFormValues());

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.message)).toContain('症状を選択してください');
    expect(parsed.error?.issues.map((issue) => issue.message)).toContain(
      '深刻度を選択してください',
    );
  });

  it('patch schema は負数を拒否する', () => {
    const parsed = issueReportPatchFormSchema.safeParse({
      ...buildIssueReportPatchFormValues(null),
      avgPingMs: -1,
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe('0 以上の値を入力してください');
  });

  it('create payload adapter は空の添付草稿を除外する', () => {
    const payload = toIssueReportCreatePayload(
      {
        ...buildIssueReportCreateFormValues('wifi-1'),
        symptom: 'high_latency',
        severity: 'high',
        attachments: [createEmptyIssueReportAttachment()],
      },
      {
        teamId: '00000000-0000-4000-8000-000000000011',
        selectedConfig: {
          id: '00000000-0000-4000-8000-000000000021',
          band: '5GHz',
          channel: 36,
          channelWidthMHz: 80,
        },
        selectedApModel: 'AP-9000',
        selectedClientModel: 'Client-1',
      },
    );

    expect(payload).toMatchObject({
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      symptom: 'high_latency',
      severity: 'high',
      band: '5GHz',
      channel: 36,
      channelWidthMHz: 80,
      apDeviceModel: 'AP-9000',
      clientDeviceModel: 'Client-1',
    });
    expect(payload.attachments).toBeUndefined();
  });

  it('patch adapter は空値を null clearing に変換する', () => {
    const patch = toIssueReportPatchInput({
      ...buildIssueReportPatchFormValues(null),
      visibility: 'team_private',
    });

    expect(patch).toEqual({
      visibility: 'team_private',
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
  });

  it('validated patch と resend payload merge は同じ patch 経路を使う', () => {
    const patch = toValidatedIssueReportPatchInput({
      ...buildIssueReportPatchFormValues(null),
      visibility: 'team_public',
      reporterName: '  Updated Reporter  ',
      avgPingMs: 55,
      description: '',
    });
    const payload = applyIssueReportPatchToCreatePayload(
      {
        teamId: '00000000-0000-4000-8000-000000000011',
        wifiConfigId: '00000000-0000-4000-8000-000000000021',
        visibility: 'team_private',
        symptom: 'high_latency',
        severity: 'high',
        band: '5GHz',
        channel: 36,
        description: 'offline note',
      },
      patch,
    );

    expect(patch).toMatchObject({
      visibility: 'team_public',
      reporterName: 'Updated Reporter',
      avgPingMs: 55,
      description: null,
    });
    expect(payload).toMatchObject({
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      visibility: 'team_public',
      symptom: 'high_latency',
      severity: 'high',
      band: '5GHz',
      channel: 36,
      reporterName: 'Updated Reporter',
      avgPingMs: 55,
    });
    expect(payload).not.toHaveProperty('description');
  });

  it('patch form values は local payload と server record の両方から初期化できる', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '00000000-0000-4000-8000-000000000099',
    });

    const serverValues = buildIssueReportPatchFormValues({
      id: '00000000-0000-4000-8000-000000000061',
      tournamentId: '00000000-0000-4000-8000-000000000001',
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      visibility: 'team_private',
      band: '5GHz',
      channel: 36,
      channelWidthMHz: 80,
      symptom: 'high_latency',
      severity: 'high',
      avgPingMs: 42,
      maxPingMs: 80,
      packetLossPercent: 3,
      distanceCategory: 'mid',
      estimatedDistanceMeters: 8,
      locationLabel: 'East Hall',
      reproducibility: 'sometimes',
      description: 'server note',
      mitigationTried: ['change_channel'],
      improved: false,
      attachments: [{ name: 'capture.txt', sizeBytes: 12 }],
      apDeviceModel: 'AP-9000',
      clientDeviceModel: 'Client-1',
      createdAt: '2026-04-22T12:00:00.000Z',
      updatedAt: '2026-04-22T12:00:00.000Z',
    } satisfies IssueReportView);

    const localValues = buildIssueReportPatchFormValues(null, {
      teamId: '00000000-0000-4000-8000-000000000011',
      wifiConfigId: '00000000-0000-4000-8000-000000000021',
      visibility: 'team_public',
      symptom: 'high_latency',
      severity: 'high',
      band: '5GHz',
      channel: 36,
      description: 'offline note',
    });

    expect(serverValues.description).toBe('server note');
    expect(serverValues.attachments[0]?.name).toBe('capture.txt');
    expect(localValues.visibility).toBe('team_public');
    expect(localValues.description).toBe('offline note');
  });
});
