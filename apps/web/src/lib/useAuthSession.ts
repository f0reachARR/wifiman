import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TeamAccessRole } from '@wifiman/shared';
import {
  clearStoredAuthSession,
  createOperatorSession,
  createTeamSession,
  getStoredAuthSession,
  setStoredAuthSession,
} from './auth.js';

const authQueryKey = ['auth', 'session'] as const;

export function useAuthSession() {
  return useQuery({
    queryKey: authQueryKey,
    queryFn: async () => getStoredAuthSession(),
    initialData: getStoredAuthSession(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useAuthActions() {
  const queryClient = useQueryClient();

  return {
    signInAsOperator(displayName: string) {
      const session = createOperatorSession(displayName);
      setStoredAuthSession(session);
      void queryClient.setQueryData(authQueryKey, session);
      return session;
    },
    signInWithTeamAccess(token: string, role: TeamAccessRole) {
      const session = createTeamSession(token, role);
      setStoredAuthSession(session);
      void queryClient.setQueryData(authQueryKey, session);
      return session;
    },
    signOut() {
      clearStoredAuthSession();
      void queryClient.setQueryData(authQueryKey, null);
    },
  };
}
