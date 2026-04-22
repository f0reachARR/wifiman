import { Loader, Stack, Text, Title } from '@mantine/core';
import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  redirect,
} from '@tanstack/react-router';
import { AppShellLayout } from './components/AppShellLayout.js';
import { getProtectedRedirectPath } from './lib/auth.js';
import { isOperatorSession } from './lib/authz.js';
import { authSessionQueryOptions } from './lib/useAuthSession.js';
import { AppDashboardPage } from './routes/AppDashboardPage.js';
import { BestPracticesPage } from './routes/BestPracticesPage.js';
import { HomePage } from './routes/HomePage.js';
import { IssueReportCreatePage } from './routes/IssueReportCreatePage.js';
import { IssueReportDetailPage } from './routes/IssueReportDetailPage.js';
import { LoginPage } from './routes/LoginPage.js';
import { OfflinePage } from './routes/OfflinePage.js';
import { SyncPage } from './routes/SyncPage.js';
import { TeamAccessPage } from './routes/TeamAccessPage.js';
import { TeamDetailPage } from './routes/TeamDetailPage.js';
import { TeamListPage } from './routes/TeamListPage.js';
import { TournamentChannelMapPage } from './routes/TournamentChannelMapPage.js';
import { TournamentOverviewPage } from './routes/TournamentOverviewPage.js';

type RouterContext = {
  queryClient: QueryClient;
};

function RootLayout() {
  return (
    <AppShellLayout>
      <Outlet />
    </AppShellLayout>
  );
}

function PendingPage() {
  return (
    <Stack align='center' gap='sm' py='xl'>
      <Loader color='teal' />
      <Text c='dimmed'>画面を準備しています</Text>
    </Stack>
  );
}

function NotFoundPage() {
  return (
    <Stack gap='sm'>
      <Title order={2}>ページが見つかりません</Title>
      <Text c='dimmed'>URL を確認するか、ホームへ戻ってください。</Text>
    </Stack>
  );
}

async function ensureAuthenticatedForPath(
  queryClient: QueryClient,
  pathname: string,
  search: string,
) {
  const session = await queryClient.fetchQuery(authSessionQueryOptions());
  const destination = getProtectedRedirectPath(pathname, session, search);

  if (!destination) {
    return;
  }

  if (destination === '/login') {
    throw redirect({ to: '/login' });
  }

  const [, destinationSearch = ''] = destination.split('?');
  const next = new URLSearchParams(destinationSearch).get('next');

  if (!next) {
    throw redirect({ to: '/login' });
  }

  throw redirect({
    to: '/login',
    search: { next },
  });
}

async function ensureOperatorForPath(queryClient: QueryClient, pathname: string, search: string) {
  const session = await queryClient.fetchQuery(authSessionQueryOptions());
  const destination = getProtectedRedirectPath(pathname, session, search);

  if (destination) {
    if (destination === '/login') {
      throw redirect({ to: '/login' });
    }

    const [, destinationSearch = ''] = destination.split('?');
    const next = new URLSearchParams(destinationSearch).get('next');

    if (!next) {
      throw redirect({ to: '/login' });
    }

    throw redirect({
      to: '/login',
      search: { next },
    });
  }

  if (!isOperatorSession(session)) {
    throw redirect({ to: '/' });
  }
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  pendingComponent: PendingPage,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const teamAccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/team-access',
  component: TeamAccessPage,
});

const offlineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/offline',
  component: OfflinePage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  beforeLoad: async ({ context, location }) => {
    await ensureOperatorForPath(context.queryClient, location.pathname, location.searchStr);
  },
  component: AppDashboardPage,
});

const appSyncRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/sync',
  beforeLoad: async ({ context, location }) => {
    await ensureOperatorForPath(context.queryClient, location.pathname, location.searchStr);
  },
  component: SyncPage,
});

const tournamentOverviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tournaments/$tournamentId',
  component: function TournamentOverviewRouteComponent() {
    const { tournamentId } = tournamentOverviewRoute.useParams();
    return <TournamentOverviewPage tournamentId={tournamentId} />;
  },
});

const tournamentTeamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tournaments/$tournamentId/teams',
  component: function TournamentTeamsRouteComponent() {
    const { tournamentId } = tournamentTeamsRoute.useParams();
    return <TeamListPage tournamentId={tournamentId} />;
  },
});

const tournamentChannelMapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tournaments/$tournamentId/channel-map',
  beforeLoad: async ({ context, location }) => {
    await ensureAuthenticatedForPath(context.queryClient, location.pathname, location.searchStr);
  },
  component: function TournamentChannelMapRouteComponent() {
    const { tournamentId } = tournamentChannelMapRoute.useParams();
    return <TournamentChannelMapPage tournamentId={tournamentId} />;
  },
});

const tournamentIssueReportCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tournaments/$tournamentId/issue-reports/new',
  beforeLoad: async ({ context, location }) => {
    await ensureAuthenticatedForPath(context.queryClient, location.pathname, location.searchStr);
  },
  component: function TournamentIssueReportCreateRouteComponent() {
    const { tournamentId } = tournamentIssueReportCreateRoute.useParams();
    return <IssueReportCreatePage tournamentId={tournamentId} />;
  },
});

const tournamentIssueReportDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tournaments/$tournamentId/issue-reports/$issueReportId',
  beforeLoad: async ({ context, location }) => {
    await ensureAuthenticatedForPath(context.queryClient, location.pathname, location.searchStr);
  },
  component: function TournamentIssueReportDetailRouteComponent() {
    const { tournamentId, issueReportId } = tournamentIssueReportDetailRoute.useParams();
    return <IssueReportDetailPage tournamentId={tournamentId} issueReportId={issueReportId} />;
  },
});

const tournamentBestPracticesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tournaments/$tournamentId/best-practices',
  component: function TournamentBestPracticesRouteComponent() {
    const { tournamentId } = tournamentBestPracticesRoute.useParams();
    return <BestPracticesPage tournamentId={tournamentId} />;
  },
});

const teamDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tournaments/$tournamentId/teams/$teamId',
  beforeLoad: async ({ context, location }) => {
    await ensureAuthenticatedForPath(context.queryClient, location.pathname, location.searchStr);
  },
  component: function TeamDetailRouteComponent() {
    const { tournamentId, teamId } = teamDetailRoute.useParams();
    return <TeamDetailPage tournamentId={tournamentId} teamId={teamId} />;
  },
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  teamAccessRoute,
  offlineRoute,
  appRoute,
  appSyncRoute,
  tournamentOverviewRoute,
  tournamentTeamsRoute,
  tournamentChannelMapRoute,
  tournamentIssueReportCreateRoute,
  tournamentIssueReportDetailRoute,
  tournamentBestPracticesRoute,
  teamDetailRoute,
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: {
      queryClient,
    },
    defaultPreload: 'intent',
    defaultPendingComponent: PendingPage,
  });
}

type AppRouter = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}

type AppRouterProviderProps = {
  router: AppRouter;
};

export function AppRouterProvider({ router }: AppRouterProviderProps) {
  return <RouterProvider router={router} />;
}
