import { describe, expect, it } from 'vitest';
import { createOperatorSession, createTeamSession, getProtectedRedirectPath } from './auth.js';

describe('auth helpers', () => {
  it('未認証で /app にアクセスした場合は login へ誘導する', () => {
    expect(getProtectedRedirectPath('/app', null)).toBe('/login');
  });

  it('未認証で /app/sync にアクセスした場合は次画面付きで login へ誘導する', () => {
    expect(getProtectedRedirectPath('/app/sync', null)).toBe('/login?next=%2Fapp%2Fsync');
  });

  it('認証済みなら保護ルートでも遷移を妨げない', () => {
    expect(getProtectedRedirectPath('/app', createOperatorSession('operator'))).toBeNull();
    expect(
      getProtectedRedirectPath('/app/sync', createTeamSession('a'.repeat(64), 'editor')),
    ).toBeNull();
  });
});
