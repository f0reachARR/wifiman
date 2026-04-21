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

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });

describe('team management routes', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        const responses: Record<string, MockResponse> = {
          '/api/auth/session': {
            status: 401,
            body: { error: { code: 'UNAUTHORIZED', message: 'unauthorized' } },
          },
          '/api/tournaments': {
            status: 200,
            body: [
              {
                id: '00000000-0000-4000-8000-000000000001',
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
          '/api/tournaments/00000000-0000-4000-8000-000000000001/public-overview': {
            status: 200,
            body: {
              tournament: {
                id: '00000000-0000-4000-8000-000000000001',
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
          '/api/tournaments/00000000-0000-4000-8000-000000000001/notices': {
            status: 200,
            body: [],
          },
          '/api/tournaments/00000000-0000-4000-8000-000000000001/best-practices': {
            status: 200,
            body: [],
          },
          '/api/tournaments/00000000-0000-4000-8000-000000000001': {
            status: 200,
            body: {
              id: '00000000-0000-4000-8000-000000000001',
              name: 'Spring Cup',
              venueName: 'Main Hall',
              startDate: '2026-04-21',
              endDate: '2026-04-22',
              description: 'Tournament for testing',
              createdAt: '2026-04-01T00:00:00.000Z',
              updatedAt: '2026-04-01T00:00:00.000Z',
            },
          },
          '/api/tournaments/00000000-0000-4000-8000-000000000001/teams': {
            status: 200,
            body: [
              {
                id: '00000000-0000-4000-8000-000000000011',
                tournamentId: '00000000-0000-4000-8000-000000000001',
                name: 'Alpha',
                organization: 'A School',
                pitId: 'P-1',
                createdAt: '2026-04-01T00:00:00.000Z',
                updatedAt: '2026-04-01T00:00:00.000Z',
              },
            ],
          },
        };

        const path = url.replace('http://localhost:3000', '');
        const matched = responses[path];
        if (!matched) {
          throw new Error(`Unhandled fetch: ${path}`);
        }
        if (matched.status === 401) {
          return jsonResponse(matched.body, 401);
        }
        return jsonResponse(matched.body, matched.status);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('公開大会トップからチーム一覧へ遷移できる', async () => {
    window.history.pushState({}, '', '/tournaments/00000000-0000-4000-8000-000000000001');

    const queryClient = new QueryClient();
    const router = createAppRouter(queryClient);
    render(<AppProviders queryClient={queryClient} router={router} />);

    expect(await screen.findByText('Spring Cup')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'チーム一覧を見る' }));

    expect(await screen.findByText('Spring Cup チーム一覧')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '詳細はログイン後' })).toBeInTheDocument();
  });

  it('未認証で保護されたチーム詳細に入ると login へ遷移する', async () => {
    window.history.pushState(
      {},
      '',
      '/tournaments/00000000-0000-4000-8000-000000000001/teams/00000000-0000-4000-8000-000000000011',
    );

    const queryClient = new QueryClient();
    const router = createAppRouter(queryClient);
    render(<AppProviders queryClient={queryClient} router={router} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '運営ログイン' })).toBeInTheDocument();
    });
  });
});
