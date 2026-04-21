import {
  BANDS,
  type Band,
  type BestPractice,
  CHANNEL_WIDTHS,
  type ChannelMapEntry,
  getChannelRange,
} from '@wifiman/shared';

export const CHANNEL_MAP_REPORT_WARNING_THRESHOLD = 3;

export const CHANNEL_MAP_SOURCE_META = {
  own_team: {
    label: '自チーム',
    color: '#0f766e',
    accent: '#14b8a6',
  },
  participant_team: {
    label: '参加チーム',
    color: '#1d4ed8',
    accent: '#60a5fa',
  },
  observed_wifi: {
    label: '観測 WiFi',
    color: '#57534e',
    accent: '#a8a29e',
  },
} as const;

const CHANNEL_MAP_SOURCE_TYPES = ['own_team', 'participant_team', 'observed_wifi'] as const;

export type ChannelMapFilters = {
  sourceTypes: ChannelMapEntry['sourceType'][];
  controlOnly: boolean;
  reportOnly: boolean;
  widths: number[];
  modelQuery: string;
};

export type ChannelMapBandStats = {
  total: number;
  warningCount: number;
  sourceCounts: Record<ChannelMapEntry['sourceType'], number>;
};

export type ChannelMapDisplayEntry = {
  id: string;
  band: Band;
  sourceType: ChannelMapEntry['sourceType'];
  label: string;
  subtitle: string;
  detailKey: string;
  channel: number;
  channelWidthMHz: number;
  startFreqMHz: number;
  endFreqMHz: number;
  centerFreqMHz: number;
  reportCount: number;
  isWarning: boolean;
  purposeLabel: string | null;
  apDeviceModel: string | null;
  clientDeviceModel: string | null;
  status: string | null;
  ssid: string | null;
  sourceLabel: string | null;
  rssi: number | null;
  locationLabel: string | null;
  observedAt: string | null;
};

export type ChannelMapLaneEntry = ChannelMapDisplayEntry & {
  lane: number;
};

export type ChannelMapModel = {
  band: Band;
  title: string;
  visibleEntries: ChannelMapLaneEntry[];
  hiddenCount: number;
  stats: ChannelMapBandStats;
  availableModels: string[];
  practices: BestPractice[];
  domain: {
    minFreqMHz: number;
    maxFreqMHz: number;
    tickChannels: number[];
  };
};

export const DEFAULT_CHANNEL_MAP_FILTERS: ChannelMapFilters = {
  sourceTypes: [...CHANNEL_MAP_SOURCE_TYPES],
  controlOnly: false,
  reportOnly: false,
  widths: [],
  modelQuery: '',
};

const PURPOSE_LABELS: Record<string, string> = {
  control: '制御',
  video: '映像',
  debug: '検証',
  other: 'その他',
};

const BAND_TITLES: Record<Band, string> = {
  '2.4GHz': '2.4GHz 帯',
  '5GHz': '5GHz 帯',
  '6GHz': '6GHz 帯',
};

const BAND_CHANNELS: Record<Band, number[]> = {
  '2.4GHz': Array.from({ length: 13 }, (_, index) => index + 1),
  '5GHz': [
    36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149,
    153, 157, 161, 165,
  ],
  '6GHz': Array.from({ length: 59 }, (_, index) => 1 + index * 4),
};

function getEntryId(entry: ChannelMapEntry): string {
  if (entry.sourceType === 'observed_wifi') {
    return entry.observedWifiId;
  }

  return entry.wifiConfigId;
}

function getEntryLabel(entry: ChannelMapEntry): string {
  if (entry.sourceType === 'observed_wifi') {
    return entry.ssid?.trim() || 'SSID 非公開';
  }

  return entry.wifiConfigName;
}

function getEntrySubtitle(entry: ChannelMapEntry): string {
  if (entry.sourceType === 'observed_wifi') {
    return `${CHANNEL_MAP_SOURCE_META.observed_wifi.label} / ${entry.source}`;
  }

  return `${entry.teamName} / ${PURPOSE_LABELS[entry.purpose] ?? entry.purpose}`;
}

function getEntryDetailKey(entry: ChannelMapEntry): string {
  if (entry.sourceType === 'observed_wifi') {
    return `${entry.channel}ch / ${entry.channelWidthMHz ?? 20}MHz`;
  }

  return `${entry.channel}ch / ${entry.channelWidthMHz}MHz / ${entry.role}`;
}

export function createChannelMapDisplayEntries(
  entries: ChannelMapEntry[],
): ChannelMapDisplayEntry[] {
  return entries.map((entry) => {
    const widthMHz = entry.channelWidthMHz ?? 20;
    const range = getChannelRange(entry.band, entry.channel, widthMHz);

    if (entry.sourceType === 'observed_wifi') {
      return {
        id: getEntryId(entry),
        band: entry.band,
        sourceType: entry.sourceType,
        label: getEntryLabel(entry),
        subtitle: getEntrySubtitle(entry),
        detailKey: getEntryDetailKey(entry),
        channel: entry.channel,
        channelWidthMHz: widthMHz,
        startFreqMHz: range.startFreqMHz,
        endFreqMHz: range.endFreqMHz,
        centerFreqMHz: range.centerFreqMHz,
        reportCount: 0,
        isWarning: false,
        purposeLabel: null,
        apDeviceModel: null,
        clientDeviceModel: null,
        status: null,
        ssid: entry.ssid ?? null,
        sourceLabel: entry.source,
        rssi: entry.rssi,
        locationLabel: entry.locationLabel,
        observedAt: entry.observedAt,
      };
    }

    return {
      id: getEntryId(entry),
      band: entry.band,
      sourceType: entry.sourceType,
      label: getEntryLabel(entry),
      subtitle: getEntrySubtitle(entry),
      detailKey: getEntryDetailKey(entry),
      channel: entry.channel,
      channelWidthMHz: widthMHz,
      startFreqMHz: range.startFreqMHz,
      endFreqMHz: range.endFreqMHz,
      centerFreqMHz: range.centerFreqMHz,
      reportCount: entry.reportCount,
      isWarning: entry.reportCount >= CHANNEL_MAP_REPORT_WARNING_THRESHOLD,
      purposeLabel: PURPOSE_LABELS[entry.purpose] ?? entry.purpose,
      apDeviceModel: entry.apDeviceModel,
      clientDeviceModel: entry.clientDeviceModel,
      status: entry.status,
      ssid: null,
      sourceLabel: null,
      rssi: null,
      locationLabel: null,
      observedAt: null,
    };
  });
}

function matchesModelQuery(entry: ChannelMapDisplayEntry, query: string): boolean {
  if (query.length === 0) {
    return true;
  }

  const haystacks = [
    entry.apDeviceModel ?? '',
    entry.clientDeviceModel ?? '',
    entry.label,
    entry.subtitle,
  ]
    .join(' ')
    .toLowerCase();

  return haystacks.includes(query);
}

export function filterChannelMapEntries(
  entries: ChannelMapDisplayEntry[],
  filters: ChannelMapFilters,
): ChannelMapDisplayEntry[] {
  const normalizedQuery = filters.modelQuery.trim().toLowerCase();
  return entries.filter((entry) => {
    if (!filters.sourceTypes.includes(entry.sourceType)) {
      return false;
    }

    if (filters.controlOnly && entry.purposeLabel !== '制御') {
      return false;
    }

    if (filters.reportOnly && entry.reportCount <= 0) {
      return false;
    }

    if (filters.widths.length > 0 && !filters.widths.includes(entry.channelWidthMHz)) {
      return false;
    }

    return matchesModelQuery(entry, normalizedQuery);
  });
}

export function buildChannelMapLanes(entries: ChannelMapDisplayEntry[]): ChannelMapLaneEntry[] {
  const sorted = [...entries].sort((left, right) => {
    if (left.startFreqMHz !== right.startFreqMHz) {
      return left.startFreqMHz - right.startFreqMHz;
    }

    return left.endFreqMHz - right.endFreqMHz;
  });

  const laneEnds: number[] = [];

  return sorted.map((entry) => {
    let lane = laneEnds.findIndex((endFreqMHz) => endFreqMHz <= entry.startFreqMHz);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(entry.endFreqMHz);
    } else {
      laneEnds[lane] = entry.endFreqMHz;
    }

    return {
      ...entry,
      lane,
    };
  });
}

export function getChannelMapDomain(band: Band) {
  const channels = BAND_CHANNELS[band];
  const minChannel = channels[0] ?? 1;
  const maxChannel = channels[channels.length - 1] ?? minChannel;
  const minRange = getChannelRange(band, minChannel, band === '2.4GHz' ? 20 : 20);
  const maxRange = getChannelRange(band, maxChannel, band === '2.4GHz' ? 40 : 160);

  return {
    minFreqMHz: minRange.startFreqMHz,
    maxFreqMHz: maxRange.endFreqMHz,
    tickChannels: channels,
  };
}

export function summarizeBand(entries: ChannelMapDisplayEntry[]): ChannelMapBandStats {
  return entries.reduce<ChannelMapBandStats>(
    (accumulator, entry) => {
      accumulator.total += 1;
      accumulator.sourceCounts[entry.sourceType] += 1;
      if (entry.isWarning) {
        accumulator.warningCount += 1;
      }
      return accumulator;
    },
    {
      total: 0,
      warningCount: 0,
      sourceCounts: {
        own_team: 0,
        participant_team: 0,
        observed_wifi: 0,
      },
    },
  );
}

export function collectAvailableModels(entries: ChannelMapDisplayEntry[]): string[] {
  return Array.from(
    new Set(
      entries
        .flatMap((entry) => [entry.apDeviceModel, entry.clientDeviceModel])
        .filter((value): value is string => Boolean(value && value.trim().length > 0)),
    ),
  ).sort((left, right) => left.localeCompare(right, 'ja'));
}

export function getRelevantPractices(
  practices: BestPractice[],
  band: Band,
  selected: ChannelMapDisplayEntry | null,
) {
  const modelNames = selected
    ? [selected.apDeviceModel, selected.clientDeviceModel].filter((value): value is string =>
        Boolean(value && value.trim().length > 0),
      )
    : [];

  return practices.filter((practice) => {
    if (practice.scope === 'general' || practice.scope === 'tournament') {
      return true;
    }

    if (practice.scope === 'band') {
      return practice.targetBand === band;
    }

    return Boolean(practice.targetModel && modelNames.includes(practice.targetModel));
  });
}

export function createChannelMapModel(input: {
  band: Band;
  entries: ChannelMapEntry[];
  filters: ChannelMapFilters;
  practices: BestPractice[];
}): ChannelMapModel {
  const displayEntries = createChannelMapDisplayEntries(input.entries).filter(
    (entry) => entry.band === input.band,
  );
  const filtered = filterChannelMapEntries(displayEntries, input.filters);
  const visibleEntries = buildChannelMapLanes(filtered);

  return {
    band: input.band,
    title: BAND_TITLES[input.band],
    visibleEntries,
    hiddenCount: displayEntries.length - filtered.length,
    stats: summarizeBand(displayEntries),
    availableModels: collectAvailableModels(displayEntries),
    practices: getRelevantPractices(input.practices, input.band, visibleEntries[0] ?? null),
    domain: getChannelMapDomain(input.band),
  };
}

export function getChannelMapSourceOptions() {
  return CHANNEL_MAP_SOURCE_TYPES.map((sourceType) => ({
    value: sourceType,
    label: CHANNEL_MAP_SOURCE_META[sourceType].label,
  }));
}

export function getChannelMapWidthOptions() {
  return CHANNEL_WIDTHS.map((width) => ({
    value: String(width),
    label: `${width}MHz`,
  }));
}

export function createInitialBand(value: string | undefined): Band {
  return (BANDS.find((band) => band === value) ?? '2.4GHz') as Band;
}
