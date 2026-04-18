import { describe, expect, it } from 'vitest';
import { CreateIssueReportSchema } from '../../src/schemas/issueReport.js';

describe('CreateIssueReportSchema', () => {
  it('wifiConfigId がある場合は帯域とチャンネルを自動補完前提で省略できる', () => {
    const result = CreateIssueReportSchema.safeParse({
      tournamentId: '00000000-0000-4000-8000-000000000001',
      wifiConfigId: '00000000-0000-4000-8000-000000000031',
      symptom: 'high_latency',
      severity: 'medium',
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
