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
import { authSessionQueryOptions } from './lib/useAuthSession.js';
import { AppDashboardPage } from './routes/AppDashboardPage.js';
import { HomePage } from './routes/HomePage.js';
import { LoginPage } from './routes/LoginPage.js';
import { OfflinePage } from './routes/OfflinePage.js';
import { SyncPage } from './routes/SyncPage.js';
import { TeamAccessPage } from './routes/TeamAccessPage.js';

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

async function ensureAuthenticatedForPath(queryClient: QueryClient, pathname: string) {
  const session = await queryClient.fetchQuery(authSessionQueryOptions());
  const destination = getProtectedRedirectPath(pathname, session);

  if (!destination) {
    return;
  }

  if (destination === '/login') {
    throw redirect({ to: '/login' });
  }

  throw redirect({
    to: '/login',
    search: {
      next: '/app/sync',
    },
  });
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
    await ensureAuthenticatedForPath(context.queryClient, location.pathname);
  },
  component: AppDashboardPage,
});

const appSyncRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/sync',
  beforeLoad: async ({ context, location }) => {
    await ensureAuthenticatedForPath(context.queryClient, location.pathname);
  },
  component: SyncPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  teamAccessRoute,
  offlineRoute,
  appRoute,
  appSyncRoute,
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
