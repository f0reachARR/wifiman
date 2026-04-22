import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '../../lib/auth.js';
import type { ChannelMapDisplayEntry } from '../../lib/channelMap.js';
import { ChannelMapDetailPanel } from './ChannelMapDetailPanel.js';
import { ChannelMapLegend } from './ChannelMapLegend.js';

let mockedSession: AuthSession | null = null;

vi.mock('../../lib/useAuthSession.js', () => ({
  useAuthSession: () => ({ data: mockedSession }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function renderWithMantine(ui: ReactNode) {
  render(<MantineProvider>{ui}</MantineProvider>);
}

const ownTeamEntry: ChannelMapDisplayEntry = {
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
};

const observedWifiEntry: ChannelMapDisplayEntry = {
  id: 'entry-2',
  band: '5GHz',
  sourceType: 'observed_wifi',
  teamId: null,
  wifiConfigId: null,
  label: 'Venue WiFi',
  subtitle: '観測 WiFi / wild',
  detailKey: '40ch / 20MHz',
  channel: 40,
  channelWidthMHz: 20,
  startFreqMHz: 5180,
  endFreqMHz: 5200,
  centerFreqMHz: 5190,
  reportCount: 0,
  isWarning: false,
  purposeLabel: null,
  apDeviceModel: null,
  clientDeviceModel: null,
  status: null,
  ssid: 'Venue WiFi',
  bssid: '00:11:22:33:44:55',
  sourceLabel: 'wild',
  rssi: -68,
  locationLabel: 'North Hall',
  observedAt: '2026-04-21T10:00:00.000Z',
};

afterEach(() => {
  mockedSession = null;
});

describe('ChannelMapLegend', () => {
  it('sourceType ごとの凡例ラベルを表示する', () => {
    renderWithMantine(<ChannelMapLegend />);

    expect(screen.getByText('凡例')).toBeInTheDocument();
    expect(screen.getByText('自チーム')).toBeInTheDocument();
    expect(screen.getByText('参加チーム')).toBeInTheDocument();
    expect(screen.getByText('観測 WiFi')).toBeInTheDocument();
  });
});

describe('ChannelMapDetailPanel', () => {
  it('editor セッションでは自チーム構成から報告作成導線を表示する', () => {
    mockedSession = {
      kind: 'team',
      role: 'editor',
      teamId: '00000000-0000-4000-8000-000000000011',
      tournamentId: '00000000-0000-4000-8000-000000000001',
      teamAccessId: '00000000-0000-4000-8000-000000000041',
    };

    renderWithMantine(
      <ChannelMapDetailPanel
        entry={ownTeamEntry}
        tournamentId='00000000-0000-4000-8000-000000000001'
      />,
    );

    expect(screen.getByText('問題報告が集中しています')).toBeInTheDocument();
    expect(screen.getByText('AP 型番: AP-9000')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'この構成で報告を作成する' })).toHaveAttribute(
      'href',
      '/tournaments/00000000-0000-4000-8000-000000000001/issue-reports/new?wifiConfigId=00000000-0000-4000-8000-000000000021',
    );
    expect(screen.getByRole('link', { name: 'このチームの詳細を見る' })).toHaveAttribute(
      'href',
      '/tournaments/00000000-0000-4000-8000-000000000001/teams/00000000-0000-4000-8000-000000000011',
    );
  });

  it('viewer セッションでは自チーム以外の公開情報だけを表示し報告作成導線を出さない', () => {
    mockedSession = {
      kind: 'team',
      role: 'viewer',
      teamId: '00000000-0000-4000-8000-000000000012',
      tournamentId: '00000000-0000-4000-8000-000000000001',
      teamAccessId: '00000000-0000-4000-8000-000000000042',
    };

    renderWithMantine(
      <ChannelMapDetailPanel
        entry={ownTeamEntry}
        tournamentId='00000000-0000-4000-8000-000000000001'
      />,
    );

    expect(screen.getByText('Control 5G')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'この構成で報告を作成する' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'このチームの詳細を見る' })).toBeInTheDocument();
  });

  it('observed wifi では公開可能な観測情報だけを表示しチーム一覧導線へ切り替える', () => {
    renderWithMantine(
      <ChannelMapDetailPanel
        entry={observedWifiEntry}
        tournamentId='00000000-0000-4000-8000-000000000001'
      />,
    );

    expect(screen.getByText('Venue WiFi')).toBeInTheDocument();
    expect(screen.getByText('BSSID: 00:11:22:33:44:55')).toBeInTheDocument();
    expect(screen.getByText('観測ソース: wild')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'この構成で報告を作成する' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'チーム一覧から報告先を探す' })).toHaveAttribute(
      'href',
      '/tournaments/00000000-0000-4000-8000-000000000001/teams',
    );
  });
});