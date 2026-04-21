import { QueryClient } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';
import { AppProviders } from './providers/AppProviders.js';
import { createAppRouter } from './router.js';

const container = document.getElementById('root');

if (!container) {
  throw new Error('root element not found');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createAppRouter(queryClient);

createRoot(container).render(
  <StrictMode>
    <AppProviders queryClient={queryClient} router={router} />
  </StrictMode>,
);
