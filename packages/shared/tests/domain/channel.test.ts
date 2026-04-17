import { describe, expect, it } from 'vitest';
import {
  channelToFrequencyMHz,
  doChannelsOverlap,
  getChannelRange,
  isValidChannel,
  isValidChannelWidth,
} from '../../src/domain/channel.js';

describe('isValidChannel', () => {
  describe('2.4GHz', () => {
    it('チャンネル 1〜13 は有効', () => {
      for (let ch = 1; ch <= 13; ch++) {
        expect(isValidChannel('2.4GHz', ch), `ch${ch}`).toBe(true);
      }
    });

    it('チャンネル 0 は無効', () => {
      expect(isValidChannel('2.4GHz', 0)).toBe(false);
    });

    it('チャンネル 14 は無効', () => {
      expect(isValidChannel('2.4GHz', 14)).toBe(false);
    });

    it('5GHz のチャンネル 36 は無効', () => {
      expect(isValidChannel('2.4GHz', 36)).toBe(false);
    });
  });

  describe('5GHz', () => {
    it('UNII-1 チャンネル 36, 40, 44, 48 は有効', () => {
      for (const ch of [36, 40, 44, 48]) {
        expect(isValidChannel('5GHz', ch), `ch${ch}`).toBe(true);
      }
    });

    it('UNII-3 チャンネル 149, 153, 157, 161, 165 は有効', () => {
      for (const ch of [149, 153, 157, 161, 165]) {
        expect(isValidChannel('5GHz', ch), `ch${ch}`).toBe(true);
      }
    });

    it('チャンネル 14 は無効', () => {
      expect(isValidChannel('5GHz', 14)).toBe(false);
    });

    it('2.4GHz のチャンネル 1 は無効', () => {
      expect(isValidChannel('5GHz', 1)).toBe(false);
    });

    it('チャンネル 37 (非標準) は無効', () => {
      expect(isValidChannel('5GHz', 37)).toBe(false);
    });
  });

  describe('6GHz', () => {
    it('チャンネル 1 は有効', () => {
      expect(isValidChannel('6GHz', 1)).toBe(true);
    });

    it('チャンネル 5 は有効', () => {
      expect(isValidChannel('6GHz', 5)).toBe(true);
    });

    it('チャンネル 233 は有効', () => {
      expect(isValidChannel('6GHz', 233)).toBe(true);
    });

    it('チャンネル 2 は無効 (4n+1 でない)', () => {
      expect(isValidChannel('6GHz', 2)).toBe(false);
    });

    it('チャンネル 237 は無効 (上限超え)', () => {
      expect(isValidChannel('6GHz', 237)).toBe(false);
    });

    it('チャンネル 0 は無効', () => {
      expect(isValidChannel('6GHz', 0)).toBe(false);
    });
  });
});

describe('isValidChannelWidth', () => {
  it('2.4GHz は 20MHz が有効', () => {
    expect(isValidChannelWidth('2.4GHz', 20)).toBe(true);
  });

  it('2.4GHz は 40MHz が有効', () => {
    expect(isValidChannelWidth('2.4GHz', 40)).toBe(true);
  });

  it('2.4GHz は 80MHz が無効', () => {
    expect(isValidChannelWidth('2.4GHz', 80)).toBe(false);
  });

  it('2.4GHz は 160MHz が無効', () => {
    expect(isValidChannelWidth('2.4GHz', 160)).toBe(false);
  });

  it('5GHz は 160MHz が有効', () => {
    expect(isValidChannelWidth('5GHz', 160)).toBe(true);
  });

  it('6GHz は 160MHz が有効', () => {
    expect(isValidChannelWidth('6GHz', 160)).toBe(true);
  });
});

describe('channelToFrequencyMHz', () => {
  it('2.4GHz ch1 → 2412 MHz', () => {
    expect(channelToFrequencyMHz('2.4GHz', 1)).toBe(2412);
  });

  it('2.4GHz ch6 → 2437 MHz', () => {
    expect(channelToFrequencyMHz('2.4GHz', 6)).toBe(2437);
  });

  it('2.4GHz ch13 → 2472 MHz', () => {
    expect(channelToFrequencyMHz('2.4GHz', 13)).toBe(2472);
  });

  it('5GHz ch36 → 5180 MHz', () => {
    expect(channelToFrequencyMHz('5GHz', 36)).toBe(5180);
  });

  it('5GHz ch149 → 5745 MHz', () => {
    expect(channelToFrequencyMHz('5GHz', 149)).toBe(5745);
  });

  it('6GHz ch1 → 5945 MHz', () => {
    expect(channelToFrequencyMHz('6GHz', 1)).toBe(5945);
  });
});

describe('getChannelRange', () => {
  it('2.4GHz ch1 20MHz → 2402〜2422 MHz', () => {
    const range = getChannelRange('2.4GHz', 1, 20);
    expect(range.centerFreqMHz).toBe(2412);
    expect(range.startFreqMHz).toBe(2402);
    expect(range.endFreqMHz).toBe(2422);
  });

  it('5GHz ch36 80MHz → 5140〜5220 MHz', () => {
    const range = getChannelRange('5GHz', 36, 80);
    expect(range.centerFreqMHz).toBe(5180);
    expect(range.startFreqMHz).toBe(5140);
    expect(range.endFreqMHz).toBe(5220);
  });

  it('5GHz ch36 20MHz → 5170〜5190 MHz', () => {
    const range = getChannelRange('5GHz', 36, 20);
    expect(range.centerFreqMHz).toBe(5180);
    expect(range.startFreqMHz).toBe(5170);
    expect(range.endFreqMHz).toBe(5190);
  });
});

describe('doChannelsOverlap', () => {
  it('同じチャンネル・幅は重複する', () => {
    expect(
      doChannelsOverlap(
        { band: '2.4GHz', channel: 6, widthMHz: 20 },
        { band: '2.4GHz', channel: 6, widthMHz: 20 },
      ),
    ).toBe(true);
  });

  it('隣接して重ならない 2.4GHz チャンネルは重複しない', () => {
    // ch1 20MHz: 2402〜2422, ch5 20MHz: 2432〜2452 → 重複なし
    expect(
      doChannelsOverlap(
        { band: '2.4GHz', channel: 1, widthMHz: 20 },
        { band: '2.4GHz', channel: 5, widthMHz: 20 },
      ),
    ).toBe(false);
  });

  it('帯域が異なる場合は重複しない', () => {
    expect(
      doChannelsOverlap(
        { band: '2.4GHz', channel: 1, widthMHz: 20 },
        { band: '5GHz', channel: 36, widthMHz: 20 },
      ),
    ).toBe(false);
  });

  it('重複する 5GHz チャンネルを検出する', () => {
    // ch36 80MHz: 5140〜5220, ch40 20MHz: 5190〜5210 → 重複
    expect(
      doChannelsOverlap(
        { band: '5GHz', channel: 36, widthMHz: 80 },
        { band: '5GHz', channel: 40, widthMHz: 20 },
      ),
    ).toBe(true);
  });
});
