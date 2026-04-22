import { describe, expect, it } from 'vitest';
import { ChannelMapEntrySchema } from '../../src/schemas/channelMap.js';

const teamConfigBase = {
  band: '2.4GHz' as const,
  channel: 6,
  channelWidthMHz: 20,
  wifiConfigId: '00000000-0000-0000-0000-000000000001',
  wifiConfigName: 'メイン構成',
  teamId: '00000000-0000-0000-0000-000000000010',
  teamName: 'チームA',
  purpose: 'control' as const,
  role: 'primary' as const,
  status: 'active' as const,
  apDeviceModel: 'AP-Model-X',
  clientDeviceModel: null,
  reportCount: 0,
};

describe('ChannelMapEntrySchema', () => {
  describe('own_team', () => {
    it('必須フィールドで parse できる', () => {
      const result = ChannelMapEntrySchema.safeParse({ sourceType: 'own_team', ...teamConfigBase });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sourceType).toBe('own_team');
        expect(result.data.reportCount).toBe(0);
        expect(result.data.apDeviceModel).toBe('AP-Model-X');
        expect(result.data.clientDeviceModel).toBeNull();
      }
    });

    it('reportCount が負数の場合は失敗する', () => {
      const result = ChannelMapEntrySchema.safeParse({
        sourceType: 'own_team',
        ...teamConfigBase,
        reportCount: -1,
      });
      expect(result.success).toBe(false);
    });

    it('wifiConfigId が UUID でない場合は失敗する', () => {
      const result = ChannelMapEntrySchema.safeParse({
        sourceType: 'own_team',
        ...teamConfigBase,
        wifiConfigId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('participant_team', () => {
    it('own_team と同じフィールド構成で parse できる', () => {
      const result = ChannelMapEntrySchema.safeParse({
        sourceType: 'participant_team',
        ...teamConfigBase,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sourceType).toBe('participant_team');
      }
    });
  });

  describe('observed_wifi', () => {
    const observedBase = {
      sourceType: 'observed_wifi' as const,
      band: '5GHz' as const,
      channel: 36,
      observedWifiId: '00000000-0000-0000-0000-000000000020',
      bssid: '00:11:22:33:44:55',
      source: 'wild' as const,
      rssi: -65,
      locationLabel: 'ピット A',
      observedAt: '2026-04-18T10:00:00.000Z',
    };

    it('必須フィールドで parse できる', () => {
      const result = ChannelMapEntrySchema.safeParse(observedBase);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sourceType).toBe('observed_wifi');
        expect(result.data.bssid).toBe('00:11:22:33:44:55');
        expect(result.data.rssi).toBe(-65);
        expect(result.data.locationLabel).toBe('ピット A');
        expect(result.data.observedAt).toBe('2026-04-18T10:00:00.000Z');
      }
    });

    it('rssi / locationLabel が null でも parse できる', () => {
      const result = ChannelMapEntrySchema.safeParse({
        ...observedBase,
        rssi: null,
        locationLabel: null,
      });
      expect(result.success).toBe(true);
    });

    it('bssid は null でも parse できる', () => {
      const result = ChannelMapEntrySchema.safeParse({
        ...observedBase,
        bssid: null,
      });
      expect(result.success).toBe(true);
    });

    it('channelWidthMHz は省略可能', () => {
      const result = ChannelMapEntrySchema.safeParse({
        ...observedBase,
        channelWidthMHz: undefined,
      });
      expect(result.success).toBe(true);
    });

    it('observedAt が必須', () => {
      const { observedAt: _omit, ...rest } = observedBase;
      const result = ChannelMapEntrySchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('sourceType バリデーション', () => {
    it('無効な sourceType は失敗する', () => {
      const result = ChannelMapEntrySchema.safeParse({
        sourceType: 'team_config', // 旧値
        ...teamConfigBase,
      });
      expect(result.success).toBe(false);
    });
  });
});
