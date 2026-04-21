import { createTheme, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AppRouterProvider } from '../router.js';
import { PwaLifecycle } from '../ui/PwaLifecycle.js';

const theme = createTheme({
  primaryColor: 'teal',
  fontFamily: 'Avenir Next, Avenir, Helvetica Neue, sans-serif',
  headings: {
    fontFamily: 'Avenir Next, Avenir, Helvetica Neue, sans-serif',
  },
  defaultRadius: 'md',
});

type AppProvidersProps = {
  children?: ReactNode;
  queryClient: QueryClient;
  router: Parameters<typeof AppRouterProvider>[0]['router'];
};

export function AppProviders({ children, queryClient, router }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <Notifications position='top-right' />
        <PwaLifecycle />
        {children ?? <AppRouterProvider router={router} />}
      </MantineProvider>
    </QueryClientProvider>
  );
}
