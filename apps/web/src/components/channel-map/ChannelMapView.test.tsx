import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChannelMapLaneEntry } from '../../lib/channelMap.js';
import { ChannelMapView } from './ChannelMapView.js';

const fiveGigahertzEntries: ChannelMapLaneEntry[] = [
  {
    id: 'entry-1',
    band: '5GHz',
    sourceType: 'own_team',
    teamId: '00000000-0000-4000-8000-000000000011',
    wifiConfigId: '00000000-0000-4000-8000-000000000021',
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
    bssid: null,
    sourceLabel: null,
    rssi: null,
    locationLabel: null,
    observedAt: null,
    lane: 0,
  },
];

const twoPointFourGigahertzEntries: ChannelMapLaneEntry[] = [
  {
    id: 'entry-2',
    band: '2.4GHz',
    sourceType: 'participant_team',
    teamId: '00000000-0000-4000-8000-000000000012',
    wifiConfigId: '00000000-0000-4000-8000-000000000022',
    label: 'Control 2.4G',
    subtitle: 'Beta / 制御',
    detailKey: '6ch / 20MHz / primary',
    channel: 6,
    channelWidthMHz: 20,
    startFreqMHz: 2427,
    endFreqMHz: 2447,
    centerFreqMHz: 2437,
    reportCount: 0,
    isWarning: false,
    purposeLabel: '制御',
    apDeviceModel: 'AP-2400',
    clientDeviceModel: null,
    status: 'active',
    ssid: null,
    bssid: null,
    sourceLabel: null,
    rssi: null,
    locationLabel: null,
    observedAt: null,
    lane: 0,
  },
];

function getNumericAttribute(element: Element, name: string) {
  const value = element.getAttribute(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return Number(value);
}

describe('ChannelMapView', () => {
  it('renders SVG bars and emits selection', () => {
    const onSelect = vi.fn();

    render(
      <MantineProvider>
        <ChannelMapView
          entries={fiveGigahertzEntries}
          domain={{
            minFreqMHz: 5140,
            maxFreqMHz: 5905,
            ticks: [
              { channel: 36, centerFreqMHz: 5180 },
              { channel: 40, centerFreqMHz: 5200 },
              { channel: 44, centerFreqMHz: 5220 },
              { channel: 48, centerFreqMHz: 5240 },
            ],
          }}
          selectedId={null}
          onSelect={onSelect}
        />
      </MantineProvider>,
    );

    expect(screen.getByRole('img', { name: 'チャンネルマップ SVG' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Control 5G bar'));
    expect(onSelect).toHaveBeenCalledWith(fiveGigahertzEntries[0]);
  });

  it('supports keyboard selection with Enter and Space', () => {
    const onSelect = vi.fn();

    render(
      <MantineProvider>
        <ChannelMapView
          entries={fiveGigahertzEntries}
          domain={{
            minFreqMHz: 5140,
            maxFreqMHz: 5905,
            ticks: [
              { channel: 36, centerFreqMHz: 5180 },
              { channel: 40, centerFreqMHz: 5200 },
              { channel: 44, centerFreqMHz: 5220 },
              { channel: 48, centerFreqMHz: 5240 },
            ],
          }}
          selectedId={null}
          onSelect={onSelect}
        />
      </MantineProvider>,
    );

    const bar = screen.getByLabelText('Control 5G bar');

    expect(bar).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(bar, { key: 'Enter' });
    fireEvent.keyDown(bar, { key: ' ' });

    expect(onSelect).toHaveBeenNthCalledWith(1, fiveGigahertzEntries[0]);
    expect(onSelect).toHaveBeenNthCalledWith(2, fiveGigahertzEntries[0]);
  });

  it('shows a visible focus outline for the focused bar', () => {
    const { container } = render(
      <MantineProvider>
        <ChannelMapView
          entries={fiveGigahertzEntries}
          domain={{
            minFreqMHz: 5140,
            maxFreqMHz: 5905,
            ticks: [
              { channel: 36, centerFreqMHz: 5180 },
              { channel: 40, centerFreqMHz: 5200 },
              { channel: 44, centerFreqMHz: 5220 },
              { channel: 48, centerFreqMHz: 5240 },
            ],
          }}
          selectedId={null}
          onSelect={vi.fn()}
        />
      </MantineProvider>,
    );

    const bar = screen.getByLabelText('Control 5G bar');

    expect(bar).not.toHaveAttribute('data-focus-visible', 'true');
    expect(container.querySelector('rect[data-focus-outline-for="entry-1"]')).toBeNull();

    fireEvent.focus(bar);

    expect(bar).toHaveAttribute('data-focus-visible', 'true');
    expect(container.querySelector('rect[data-focus-outline-for="entry-1"]')).toBeInTheDocument();

    fireEvent.blur(bar);

    expect(bar).not.toHaveAttribute('data-focus-visible', 'true');
    expect(container.querySelector('rect[data-focus-outline-for="entry-1"]')).toBeNull();
  });

  it('aligns 5GHz tick labels with the bar center frequency', () => {
    const { container } = render(
      <MantineProvider>
        <ChannelMapView
          entries={fiveGigahertzEntries}
          domain={{
            minFreqMHz: 5140,
            maxFreqMHz: 5905,
            ticks: [
              { channel: 36, centerFreqMHz: 5180 },
              { channel: 40, centerFreqMHz: 5200 },
              { channel: 44, centerFreqMHz: 5220 },
              { channel: 48, centerFreqMHz: 5240 },
            ],
          }}
          selectedId={null}
          onSelect={vi.fn()}
        />
      </MantineProvider>,
    );

    const tick = container.querySelector('text[data-channel="36"]');
    const bar = container.querySelector('rect[data-entry-id="entry-1"]');

    if (!tick || !bar) {
      throw new Error('Expected SVG elements were not rendered');
    }

    const tickX = getNumericAttribute(tick, 'x');
    const barCenterX = getNumericAttribute(bar, 'x') + getNumericAttribute(bar, 'width') / 2;
    expect(tickX).toBeCloseTo(barCenterX, 3);
  });

  it('aligns 2.4GHz representative ticks with the bar center frequency', () => {
    const { container } = render(
      <MantineProvider>
        <ChannelMapView
          entries={twoPointFourGigahertzEntries}
          domain={{
            minFreqMHz: 2402,
            maxFreqMHz: 2492,
            ticks: [
              { channel: 1, centerFreqMHz: 2412 },
              { channel: 6, centerFreqMHz: 2437 },
              { channel: 11, centerFreqMHz: 2462 },
            ],
          }}
          selectedId={null}
          onSelect={vi.fn()}
        />
      </MantineProvider>,
    );

    const tick = container.querySelector('text[data-channel="6"]');
    const bar = container.querySelector('rect[data-entry-id="entry-2"]');

    if (!tick || !bar) {
      throw new Error('Expected SVG elements were not rendered');
    }

    const tickX = getNumericAttribute(tick, 'x');
    const barCenterX = getNumericAttribute(bar, 'x') + getNumericAttribute(bar, 'width') / 2;
    expect(tickX).toBeCloseTo(barCenterX, 3);
  });
});
