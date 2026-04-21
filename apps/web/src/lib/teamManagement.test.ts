import { describe, expect, it } from 'vitest';
import {
  buildWifiConfigFormValues,
  parseDeviceSpecFormValues,
  parseTeamFormValues,
  parseWifiConfigFormValues,
} from './teamManagement.js';

describe('team management validation', () => {
  it('チーム情報は shared schema ベースで検証する', () => {
    const parsed = parseTeamFormValues({
      name: '',
      organization: '',
      pitId: '',
      contactEmail: 'invalid-email',
      displayContactName: '',
      notes: '',
    });

    expect(parsed.data).toBeUndefined();
    expect(parsed.errors.name).toBeTruthy();
    expect(parsed.errors.contactEmail).toBeTruthy();
  });

  it('WiFi 構成は active/standby の最大 3 件制約を守る', () => {
    const values = {
      ...buildWifiConfigFormValues(),
      name: 'Primary Control',
    };
    const parsed = parseWifiConfigFormValues(values, [
      { id: 'a', status: 'active' },
      { id: 'b', status: 'active' },
      { id: 'c', status: 'standby' },
    ]);

    expect(parsed.data).toBeUndefined();
    expect(parsed.formError).toContain('最大 3 件');
  });

  it('WiFi 構成は帯域とチャンネル幅の整合性を検証する', () => {
    const parsed = parseWifiConfigFormValues(
      {
        ...buildWifiConfigFormValues(),
        name: 'Invalid Config',
        band: '2.4GHz',
        channel: '36',
        channelWidthMHz: '80',
      },
      [],
    );

    expect(parsed.data).toBeUndefined();
    expect(parsed.errors.channel ?? parsed.errors.channelWidthMHz).toBeTruthy();
    expect(parsed.errors.channelWidthMHz).toBeTruthy();
  });

  it('機材仕様は対応帯域が必須', () => {
    const parsed = parseDeviceSpecFormValues({
      vendor: '',
      model: 'AP-01',
      kind: 'ap',
      supportedBands: [],
      notes: '',
      knownIssues: '',
    });

    expect(parsed.data).toBeUndefined();
    expect(parsed.errors.supportedBands).toBeTruthy();
  });
});
