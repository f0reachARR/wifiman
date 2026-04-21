import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChannelMapLaneEntry } from '../../lib/channelMap.js';
import { ChannelMapView } from './ChannelMapView.js';

const entries: ChannelMapLaneEntry[] = [
  {
    id: 'entry-1',
    band: '5GHz',
    sourceType: 'own_team',
    label: 'Control 5G',
    subtitle: 'Alpha / 制御',
    detailKey: '36ch / 80MHz / primary',
    channel: 36,
    channelWidthMHz: 80,
    startFreqMHz: 5140,
    endFreqMHz: 5220,
    centerFreqMHz: 5180,
    reportCount: 3,
    isWarning: true,
    purposeLabel: '制御',
    apDeviceModel: 'AP-9000',
    clientDeviceModel: 'Client-1',
    status: 'active',
    ssid: null,
    sourceLabel: null,
    rssi: null,
    locationLabel: null,
    observedAt: null,
    lane: 0,
  },
];

describe('ChannelMapView', () => {
  it('renders SVG bars and emits selection', () => {
    const onSelect = vi.fn();

    render(
      <MantineProvider>
        <ChannelMapView
          entries={entries}
          domain={{ minFreqMHz: 5140, maxFreqMHz: 5905, tickChannels: [36, 40, 44, 48] }}
          selectedId={null}
          onSelect={onSelect}
        />
      </MantineProvider>,
    );

    expect(screen.getByRole('img', { name: 'チャンネルマップ SVG' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Control 5G bar'));
    expect(onSelect).toHaveBeenCalledWith(entries[0]);
  });
});
