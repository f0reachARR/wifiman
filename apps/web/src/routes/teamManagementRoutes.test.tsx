import { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/betterAuthClient.js', () => ({
  betterAuthClient: {
    signIn: {
      email: vi.fn(),
    },
  },
}));

vi.mock('../ui/PwaLifecycle.js', () => ({
  PwaLifecycle: () => null,
}));

import { AppProviders } from '../providers/AppProviders.js';
import { createAppRouter } from '../router.js';

type MockResponse = {
  status: number;
  body?: unknown;
};

const tournamentId = '00000000-0000-4000-8000-000000000001';
const ownTeamId = '00000000-0000-4000-8000-000000000011';
const otherTeamId = '00000000-0000-4000-8000-000000000012';
const ownWifiId = '00000000-0000-4000-8000-000000000021';
const ownApId = '00000000-0000-4000-8000-000000000031';
const ownClientId = '00000000-0000-4000-8000-000000000032';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });

const ownTeamSession = {
  kind: 'team' as const,
  role: 'editor' as const,
  teamId: ownTeamId,
  tournamentId,
  teamAccessId: '00000000-0000-4000-8000-000000000041',
};

const otherTeamSession = {
  kind: 'team' as const,
  role: 'viewer' as const,
  teamId: otherTeamId,
  tournamentId,
  teamAccessId: '00000000-0000-4000-8000-000000000042',
};

function createBaseResponses(session: typeof ownTeamSession | typeof otherTeamSession | null) {
  return {
    '/api/auth/session': session
      ? ({ status: 200, body: session } satisfies MockResponse)
      : ({
          status: 401,
          body: { error: { code: 'UNAUTHORIZED', message: 'unauthorized' } },
        } satisfies MockResponse),
    '/api/tournaments': {
      status: 200,
      body: [
        {
          id: tournamentId,
          name: 'Spring Cup',
          venueName: 'Main Hall',
          startDate: '2026-04-21',
          endDate: '2026-04-22',
          description: 'Tournament for testing',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    },
    [`/api/tournaments/${tournamentId}/public-overview`]: {
      status: 200,
      body: {
        tournament: {
          id: tournamentId,
          name: 'Spring Cup',
          venueName: 'Main Hall',
          startDate: '2026-04-21',
          endDate: '2026-04-22',
          description: 'Tournament for testing',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        teamCount: 2,
        wifiConfigSummary: {
          '2.4GHz': 1,
          '5GHz': 2,
          '6GHz': 0,
        },
        publicIssueReportCount: 3,
        noticeCount: 1,
      },
    },
    [`/api/tournaments/${tournamentId}/notices`]: {
      status: 200,
      body: [],
    },
    [`/api/tournaments/${tournamentId}`]: {
      status: 200,
      body: {
        id: tournamentId,
        name: 'Spring Cup',
        venueName: 'Main Hall',
        startDate: '2026-04-21',
        endDate: '2026-04-22',
        description: 'Tournament for testing',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    },
    [`/api/tournaments/${tournamentId}/teams`]: {
      status: 200,
      body: [
        {
          id: ownTeamId,
          tournamentId,
          name: 'Alpha',
          organization: 'A School',
          pitId: 'P-1',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: otherTeamId,
          tournamentId,
          name: 'Beta',
          organization: 'B School',
          pitId: 'P-2',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    },
  } satisfies Record<string, MockResponse>;
}

function createOwnTeamDetailResponses() {
  return {
    ...createBaseResponses(ownTeamSession),
    [`/api/tournaments/${tournamentId}/best-practices`]: {
      status: 200,
      body: [
        {
          id: '00000000-0000-4000-8000-000000000051',
          tournamentId,
          title: '5GHz guidance',
          body: '5GHz の混雑を避ける',
          scope: 'band',
          targetBand: '5GHz',
          targetModel: null,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    },
    [`/api/teams/${ownTeamId}`]: {
      status: 200,
      body: {
        id: ownTeamId,
        tournamentId,
        name: 'Alpha',
        organization: 'A School',
        pitId: 'P-1',
        contactEmail: 'alpha@example.com',
        displayContactName: 'Alpha Rep',
        notes: 'internal memo',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    },
    [`/api/teams/${ownTeamId}/wifi-configs`]: {
      status: 200,
      body: [
        {
          id: ownWifiId,
          teamId: ownTeamId,
          name: 'Control 5G',
          purpose: 'control',
          band: '5GHz',
          channel: 36,
          channelWidthMHz: 80,
          role: 'primary',
          status: 'active',
          apDeviceId: ownApId,
          clientDeviceId: ownClientId,
          expectedDistanceCategory: 'mid',
          pingTargetIp: '192.168.10.1',
          notes: 'private wifi note',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: '00000000-0000-4000-8000-000000000022',
          teamId: ownTeamId,
          name: 'Backup 5G',
          purpose: 'debug',
          band: '5GHz',
          channel: 149,
          channelWidthMHz: 80,
          role: 'backup',
          status: 'standby',
          apDeviceId: ownApId,
          clientDeviceId: ownClientId,
          expectedDistanceCategory: 'near',
          pingTargetIp: null,
          notes: null,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    },
    [`/api/teams/${ownTeamId}/device-specs`]: {
      status: 200,
      body: [
        {
          id: ownApId,
          teamId: ownTeamId,
          vendor: 'Acme',
          model: 'AP-9000',
          kind: 'ap',
          supportedBands: ['5GHz'],
          notes: 'private device note',
          knownIssues: 'DFS 切替で瞬断しやすい',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
          archivedAt: null,
        },
        {
          id: ownClientId,
          teamId: ownTeamId,
          vendor: 'Acme',
          model: 'Client-1',
          kind: 'client',
          supportedBands: ['5GHz'],
          notes: null,
          knownIssues: null,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
          archivedAt: null,
        },
      ],
    },
    [`/api/tournaments/${tournamentId}/issue-reports`]: {
      status: 200,
      body: [
        {
          id: '00000000-0000-4000-8000-000000000061',
          tournamentId,
          teamId: ownTeamId,
          wifiConfigId: ownWifiId,
          reporterName: 'Driver A',
          visibility: 'team_private',
          band: '5GHz',
          channel: 36,
          channelWidthMHz: 80,
          symptom: 'high_latency',
          severity: 'high',
          avgPingMs: 25,
          maxPingMs: 60,
          packetLossPercent: 2,
          distanceCategory: 'mid',
          estimatedDistanceMeters: 10,
          locationLabel: 'East Hall',
          reproducibility: 'sometimes',
          description: 'AP の近くで遅延増加',
          mitigationTried: ['change_channel'],
          improved: true,
          apDeviceModel: 'AP-9000',
          clientDeviceModel: 'Client-1',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    },
  } satisfies Record<string, MockResponse>;
}

function createOtherTeamDetailResponses() {
  return {
    ...createBaseResponses(otherTeamSession),
    [`/api/tournaments/${tournamentId}/best-practices`]: {
      status: 200,
      body: [],
    },
    [`/api/teams/${ownTeamId}`]: {
      status: 200,
      body: {
        id: ownTeamId,
        tournamentId,
        name: 'Alpha',
        organization: 'A School',
        pitId: 'P-1',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    },
    [`/api/teams/${ownTeamId}/wifi-configs`]: {
      status: 200,
      body: [
        {
          id: ownWifiId,
          teamId: ownTeamId,
          name: 'Control 5G',
          purpose: 'control',
          band: '5GHz',
          channel: 36,
          channelWidthMHz: 80,
          role: 'primary',
          status: 'active',
          apDeviceId: ownApId,
          clientDeviceId: ownClientId,
          expectedDistanceCategory: 'mid',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    },
    [`/api/teams/${ownTeamId}/device-specs`]: {
      status: 200,
      body: [
        {
          id: ownApId,
          teamId: ownTeamId,
          vendor: 'Acme',
          model: 'AP-9000',
          kind: 'ap',
          supportedBands: ['5GHz'],
          knownIssues: 'DFS 切替で瞬断しやすい',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    },
    [`/api/tournaments/${tournamentId}/issue-reports`]: {
      status: 200,
      body: [
        {
          id: '00000000-0000-4000-8000-000000000071',
          tournamentId,
          teamId: ownTeamId,
          wifiConfigId: ownWifiId,
          visibility: 'team_public',
          band: '5GHz',
          channel: 36,
          channelWidthMHz: 80,
          symptom: 'unstable',
          severity: 'medium',
          avgPingMs: 15,
          maxPingMs: 40,
          packetLossPercent: 1,
          distanceCategory: 'mid',
          estimatedDistanceMeters: 8,
          reproducibility: 'sometimes',
          mitigationTried: ['change_channel'],
          improved: false,
          apDeviceModel: 'AP-9000',
          clientDeviceModel: 'Client-1',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    },
  } satisfies Record<string, MockResponse>;
}

function renderRoute(pathname: string, responses: Record<string, MockResponse>) {
  window.history.pushState({}, '', pathname);

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const path = url.replace('http://localhost:3000', '');
      const matched = responses[path];

      if (!matched) {
        throw new Error(`Unhandled fetch: ${path}`);
      }

      return jsonResponse(matched.body, matched.status);
    }),
  );

  const queryClient = new QueryClient();
  const router = createAppRouter(queryClient);
  render(<AppProviders queryClient={queryClient} router={router} />);
}

describe('team management routes', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('公開大会トップからチーム一覧へ遷移できる', async () => {
    renderRoute(`/tournaments/${tournamentId}`, {
      ...createBaseResponses(null),
      [`/api/tournaments/${tournamentId}/best-practices`]: {
        status: 200,
        body: [],
      },
    });

    expect(await screen.findByText('Spring Cup')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'チーム一覧を見る' }));

    expect(await screen.findByText('Spring Cup チーム一覧')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '詳細はログイン後' })).toHaveLength(2);
  });

  it('未認証で保護されたチーム詳細に入ると元 URL を next に保持して login へ遷移する', async () => {
    renderRoute(`/tournaments/${tournamentId}/teams/${ownTeamId}`, createBaseResponses(null));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '運営ログイン' })).toBeInTheDocument();
    });

    expect(window.location.pathname).toBe('/login');
    expect(window.location.search).toBe(
      `?next=${encodeURIComponent(`/tournaments/${tournamentId}/teams/${ownTeamId}`)}`,
    );
  });

  it('自チーム詳細では報告一覧に詳細 DTO を表示し、WiFi editor で補助表示を出す', async () => {
    renderRoute(`/tournaments/${tournamentId}/teams/${ownTeamId}`, createOwnTeamDetailResponses());

    expect(await screen.findByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByText('報告者: Driver A')).toBeInTheDocument();
    expect(screen.getByText('場所: East Hall')).toBeInTheDocument();
    expect(screen.getByText('詳細: AP の近くで遅延増加')).toBeInTheDocument();

    const [editButton] = screen.getAllByRole('button', { name: '編集' });
    if (!editButton) {
      throw new Error('edit button not found');
    }
    fireEvent.click(editButton);

    expect(await screen.findByText('同帯域の既存構成: Backup 5G (standby)')).toBeInTheDocument();
    expect(screen.getByText('5GHz の混雑を避ける')).toBeInTheDocument();
    expect(screen.getByText('AP-9000: DFS 切替で瞬断しやすい')).toBeInTheDocument();
  });

  it('他チーム詳細では team_public の公開サマリのみ表示する', async () => {
    renderRoute(
      `/tournaments/${tournamentId}/teams/${ownTeamId}`,
      createOtherTeamDetailResponses(),
    );

    expect(await screen.findByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByText('公開サマリのみ表示しています。')).toBeInTheDocument();
    expect(screen.getByText('unstable / medium')).toBeInTheDocument();
    expect(screen.queryByText(/報告者:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/場所:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/詳細:/)).not.toBeInTheDocument();
  });
});
