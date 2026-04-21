import { createAuthClient } from 'better-auth/react';

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? '/api';
}

export const betterAuthClient = createAuthClient({
  baseURL: `${getApiBaseUrl()}/auth`,
  fetchOptions: {
    credentials: 'include',
  },
}) as ReturnType<typeof createAuthClient>;
