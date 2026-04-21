import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './api/client.js';
import { getLoginMode } from './auth.js';
import { betterAuthClient } from './betterAuthClient.js';

export const authQueryKey = ['auth', 'session'] as const;

export function authSessionQueryOptions() {
  return queryOptions({
    queryKey: authQueryKey,
    queryFn: () => apiClient.getAuthSession(),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAuthSession() {
  return useQuery(authSessionQueryOptions());
}

export function useAuthActions() {
  const queryClient = useQueryClient();

  return {
    async signInAsOperator(input: {
      email: string;
      password: string;
      displayName: string;
      passphrase: string;
    }) {
      if (getLoginMode() === 'better-auth') {
        const result = await betterAuthClient.signIn.email({
          email: input.email,
          password: input.password,
        });

        if (result.error) {
          throw new Error(result.error.message ?? 'ログインに失敗しました');
        }

        const session = await apiClient.getAuthSession();

        if (!session) {
          throw new Error('認証セッションを取得できませんでした');
        }

        void queryClient.setQueryData(authQueryKey, session);
        return session;
      }

      const session = await apiClient.signInDevOperator(input.displayName, input.passphrase);
      void queryClient.setQueryData(authQueryKey, session);
      return session;
    },
    async signInWithTeamAccess(token: string) {
      const session = await apiClient.verifyTeamAccess(token);
      void queryClient.setQueryData(authQueryKey, session);
      return session;
    },
    async signOut() {
      await Promise.allSettled([apiClient.clearAuthSession(), apiClient.signOutOperator()]);
      void queryClient.setQueryData(authQueryKey, null);
    },
  };
}
