import type { BestPractice, ChannelMapEntry } from '@wifiman/shared';
import { describe, expect, it } from 'vitest';
import {
  buildChannelMapLanes,
  CHANNEL_MAP_REPORT_WARNING_THRESHOLD,
  createChannelMapDisplayEntries,
  createChannelMapModel,
  createChannelMapSearchParams,
  DEFAULT_CHANNEL_MAP_FILTERS,
  filterChannelMapEntries,
  parseChannelMapSearchParams,
} from './channelMap.js';

const entries: ChannelMapEntry[] = [
  {
    sourceType: 'own_team',
    band: '5GHz',
    channel: 36,
    channelWidthMHz: 80,
    wifiConfigId: '00000000-0000-4000-8000-000000000001',
    wifiConfigName: 'Control 5G',
    teamId: '00000000-0000-4000-8000-000000000011',
    teamName: 'Alpha',
    purpose: 'control',
    role: 'primary',
    status: 'active',
    apDeviceModel: 'AP-9000',
    clientDeviceModel: 'Client-1',
    reportCount: CHANNEL_MAP_REPORT_WARNING_THRESHOLD,
  },
  {
    sourceType: 'participant_team',
    band: '5GHz',
    channel: 149,
    channelWidthMHz: 80,
    wifiConfigId: '00000000-0000-4000-8000-000000000002',
    wifiConfigName: 'Backup 5G',
    teamId: '00000000-0000-4000-8000-000000000012',
    teamName: 'Beta',
    purpose: 'debug',
    role: 'backup',
    status: 'standby',
    apDeviceModel: 'AP-7000',
    clientDeviceModel: null,
    reportCount: 1,
  },
  {
    sourceType: 'observed_wifi',
    band: '5GHz',
    channel: 40,
    channelWidthMHz: 20,
    observedWifiId: '00000000-0000-4000-8000-000000000003',
    ssid: 'Venue WiFi',
    bssid: '00:11:22:33:44:55',
    source: 'wild',
    rssi: -68,
    locationLabel: 'North',
    observedAt: '2026-04-21T10:00:00.000Z',
  },
];

const practices: BestPractice[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    tournamentId: '00000000-0000-4000-8000-000000000201',
    title: '5GHz guidance',
    body: '5GHz は DFS を避ける',
    scope: 'band',
    targetBand: '5GHz',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
];

describe('channelMap utilities', () => {
  it('warning threshold and display fields are derived from DTO only', () => {
    const displayEntries = createChannelMapDisplayEntries(entries);
    expect(displayEntries[0]?.isWarning).toBe(true);
    expect(displayEntries[0]?.label).toBe('Control 5G');
    expect(displayEntries[2]?.label).toBe('Venue WiFi');
    expect(displayEntries[2]?.apDeviceModel).toBeNull();
    expect(displayEntries[2]?.bssid).toBe('00:11:22:33:44:55');
  });

  it('filters by source type, purpose, width and model query', () => {
    const displayEntries = createChannelMapDisplayEntries(entries);
    const filtered = filterChannelMapEntries(displayEntries, {
      ...DEFAULT_CHANNEL_MAP_FILTERS,
      sourceTypes: ['own_team'],
      controlOnly: true,
      reportOnly: true,
      widths: [80],
      modelQuery: 'ap-9000',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.sourceType).toBe('own_team');
  });

  it('does not match model query against labels or subtitles', () => {
    const displayEntries = createChannelMapDisplayEntries(entries);

    expect(
      filterChannelMapEntries(displayEntries, {
        ...DEFAULT_CHANNEL_MAP_FILTERS,
        modelQuery: 'Control 5G',
      }),
    ).toHaveLength(0);

    expect(
      filterChannelMapEntries(displayEntries, {
        ...DEFAULT_CHANNEL_MAP_FILTERS,
        modelQuery: 'Alpha',
      }),
    ).toHaveLength(0);
  });

  it('stacks overlapping entries into separate lanes', () => {
    const displayEntries = createChannelMapDisplayEntries(entries);
    const lanes = buildChannelMapLanes(
      displayEntries.filter((entry) => entry.sourceType !== 'participant_team'),
    );
    expect(lanes[0]?.lane).toBe(0);
    expect(lanes[1]?.lane).toBe(1);
  });

  it('builds a band model with stats, hidden count and practices', () => {
    const model = createChannelMapModel({
      band: '5GHz',
      entries,
      filters: {
        ...DEFAULT_CHANNEL_MAP_FILTERS,
        sourceTypes: ['own_team', 'participant_team'],
      },
      practices,
    });

    expect(model.stats.total).toBe(3);
    expect(model.hiddenCount).toBe(1);
    expect(model.practices[0]?.title).toBe('5GHz guidance');
    expect(model.visibleEntries).toHaveLength(2);
  });

  it('serializes and restores band and filter state from URL search params', () => {
    const searchParams = createChannelMapSearchParams({
      band: '5GHz',
      filters: {
        ...DEFAULT_CHANNEL_MAP_FILTERS,
        sourceTypes: ['own_team', 'observed_wifi'],
        controlOnly: true,
        reportOnly: true,
        widths: [80, 20],
        modelQuery: ' AP-9000 ',
      },
    });

    expect(searchParams.get('band')).toBe('5GHz');
    expect(searchParams.getAll('source')).toEqual(['own_team', 'observed_wifi']);
    expect(searchParams.get('controlOnly')).toBe('1');
    expect(searchParams.get('reportOnly')).toBe('1');
    expect(searchParams.getAll('width')).toEqual(['20', '80']);
    expect(searchParams.get('model')).toBe('AP-9000');

    expect(parseChannelMapSearchParams(searchParams)).toEqual({
      band: '5GHz',
      filters: {
        ...DEFAULT_CHANNEL_MAP_FILTERS,
        sourceTypes: ['own_team', 'observed_wifi'],
        controlOnly: true,
        reportOnly: true,
        widths: [20, 80],
        modelQuery: 'AP-9000',
      },
    });
  });

  it('serializes and restores an explicit empty source filter selection', () => {
    const searchParams = createChannelMapSearchParams({
      band: '5GHz',
      filters: {
        ...DEFAULT_CHANNEL_MAP_FILTERS,
        sourceTypes: [],
      },
    });

    expect(searchParams.get('band')).toBe('5GHz');
    expect(searchParams.get('sourceState')).toBe('none');
    expect(searchParams.getAll('source')).toEqual([]);

    expect(parseChannelMapSearchParams(searchParams)).toEqual({
      band: '5GHz',
      filters: {
        ...DEFAULT_CHANNEL_MAP_FILTERS,
        sourceTypes: [],
        widths: [],
      },
    });
  });

  it('falls back to defaults when URL search params are invalid', () => {
    expect(
      parseChannelMapSearchParams(
        new URLSearchParams(
          'band=900MHz&source=invalid&width=10&controlOnly=0&reportOnly=maybe&model=',
        ),
      ),
    ).toEqual({
      band: '2.4GHz',
      filters: {
        ...DEFAULT_CHANNEL_MAP_FILTERS,
        sourceTypes: [...DEFAULT_CHANNEL_MAP_FILTERS.sourceTypes],
        widths: [],
      },
    });
  });
});
