import type { Band, ChannelWidth } from '../enums.js';

// 2.4GHz: チャンネル 1〜13
const VALID_CHANNELS_2_4GHZ: ReadonlySet<number> = new Set(
  Array.from({ length: 13 }, (_, i) => i + 1),
);

// 5GHz: 標準チャンネル一覧
const VALID_CHANNELS_5GHZ: ReadonlySet<number> = new Set([
  36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149,
  153, 157, 161, 165,
]);

// 2.4GHz で有効なチャンネル幅
const VALID_WIDTHS_2_4GHZ: ReadonlySet<ChannelWidth> = new Set([20, 40] as ChannelWidth[]);

// 5GHz / 6GHz で有効なチャンネル幅
const VALID_WIDTHS_5_6GHZ: ReadonlySet<ChannelWidth> = new Set([20, 40, 80, 160] as ChannelWidth[]);

/**
 * 帯域に対してチャンネル番号が有効かどうかを確認する。
 * - 2.4GHz: 1〜13
 * - 5GHz:  規定チャンネルのみ
 * - 6GHz:  1〜233 の中で (channel - 1) % 4 === 0 のもの
 */
export function isValidChannel(band: Band, channel: number): boolean {
  if (!Number.isInteger(channel) || channel <= 0) return false;
  switch (band) {
    case '2.4GHz':
      return VALID_CHANNELS_2_4GHZ.has(channel);
    case '5GHz':
      return VALID_CHANNELS_5GHZ.has(channel);
    case '6GHz':
      return channel >= 1 && channel <= 233 && (channel - 1) % 4 === 0;
  }
}

/**
 * 帯域に対してチャンネル幅が有効かどうかを確認する。
 * - 2.4GHz: 20 / 40 MHz のみ
 * - 5GHz / 6GHz: 20 / 40 / 80 / 160 MHz
 */
export function isValidChannelWidth(band: Band, widthMHz: ChannelWidth): boolean {
  switch (band) {
    case '2.4GHz':
      return VALID_WIDTHS_2_4GHZ.has(widthMHz);
    case '5GHz':
    case '6GHz':
      return VALID_WIDTHS_5_6GHZ.has(widthMHz);
  }
}

/**
 * チャンネル番号を中心周波数 (MHz) に変換する。
 * - 2.4GHz: 2407 + channel * 5
 * - 5GHz:  5000 + channel * 5
 * - 6GHz:  5940 + channel * 5
 */
export function channelToFrequencyMHz(band: Band, channel: number): number {
  switch (band) {
    case '2.4GHz':
      return 2407 + channel * 5;
    case '5GHz':
      return 5000 + channel * 5;
    case '6GHz':
      return 5940 + channel * 5;
  }
}

export type ChannelRange = {
  centerFreqMHz: number;
  startFreqMHz: number;
  endFreqMHz: number;
};

/**
 * 指定された帯域・チャンネル・幅から占有周波数範囲を返す。
 */
export function getChannelRange(band: Band, channel: number, widthMHz: number): ChannelRange {
  const centerFreqMHz = channelToFrequencyMHz(band, channel);
  const half = widthMHz / 2;
  return {
    centerFreqMHz,
    startFreqMHz: centerFreqMHz - half,
    endFreqMHz: centerFreqMHz + half,
  };
}

/**
 * 2 つの WiFi 構成のチャンネルが重複しているかどうかを確認する。
 */
export function doChannelsOverlap(
  a: { band: Band; channel: number; widthMHz: number },
  b: { band: Band; channel: number; widthMHz: number },
): boolean {
  if (a.band !== b.band) return false;
  const rangeA = getChannelRange(a.band, a.channel, a.widthMHz);
  const rangeB = getChannelRange(b.band, b.channel, b.widthMHz);
  return rangeA.startFreqMHz < rangeB.endFreqMHz && rangeA.endFreqMHz > rangeB.startFreqMHz;
}
