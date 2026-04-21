import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_AUTHENTICATED_REDIRECT_PATH,
  getLoginMode,
  getPostLoginRedirectPath,
  getProtectedRedirectPath,
  parseAuthSession,
} from './auth.js';

describe('auth helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const operatorSession = parseAuthSession({
    kind: 'operator',
    role: 'operator',
    sessionId: 'operator-session-1',
    displayName: 'operator',
  });
  const teamSession = parseAuthSession({
    kind: 'team',
    role: 'editor',
    teamId: '00000000-0000-4000-8000-000000000011',
    tournamentId: '00000000-0000-4000-8000-000000000001',
    teamAccessId: '00000000-0000-4000-8000-000000000021',
  });

  it('未認証で /app にアクセスした場合は login へ誘導する', () => {
    expect(getProtectedRedirectPath('/app', null)).toBe('/login');
  });

  it('未認証で /app/sync にアクセスした場合は次画面付きで login へ誘導する', () => {
    expect(getProtectedRedirectPath('/app/sync', null)).toBe('/login?next=%2Fapp%2Fsync');
  });

  it('未認証で保護されたチーム詳細にアクセスした場合は next 付きで login へ誘導する', () => {
    expect(getProtectedRedirectPath('/tournaments/t-1/teams/team-1', null)).toBe(
      '/login?next=%2Ftournaments%2Ft-1%2Fteams%2Fteam-1',
    );
  });

  it('認証済みなら保護ルートでも遷移を妨げない', () => {
    expect(getProtectedRedirectPath('/app', operatorSession)).toBeNull();
    expect(getProtectedRedirectPath('/app/sync', teamSession)).toBeNull();
  });

  it('login 成功後は安全な内部 next パスへ遷移する', () => {
    expect(getPostLoginRedirectPath('/app/sync')).toBe('/app/sync');
    expect(getPostLoginRedirectPath('/app?tab=operators#status')).toBe('/app?tab=operators#status');
  });

  it('危険または無効な next は /app にフォールバックする', () => {
    expect(getPostLoginRedirectPath(null)).toBe(DEFAULT_AUTHENTICATED_REDIRECT_PATH);
    expect(getPostLoginRedirectPath('')).toBe(DEFAULT_AUTHENTICATED_REDIRECT_PATH);
    expect(getPostLoginRedirectPath('https://example.com/app')).toBe(
      DEFAULT_AUTHENTICATED_REDIRECT_PATH,
    );
    expect(getPostLoginRedirectPath('//example.com/app')).toBe(DEFAULT_AUTHENTICATED_REDIRECT_PATH);
    expect(getPostLoginRedirectPath('/\\example.com/app')).toBe(
      DEFAULT_AUTHENTICATED_REDIRECT_PATH,
    );
  });

  it('team session はサーバ発行の識別子を必須にする', () => {
    expect(teamSession.kind).toBe('team');
    if (teamSession.kind !== 'team') {
      throw new Error('expected team session');
    }
    expect(teamSession.teamAccessId).toBe('00000000-0000-4000-8000-000000000021');
    expect(() =>
      parseAuthSession({
        kind: 'team',
        role: 'editor',
        teamId: 'random-client-id',
        tournamentId: '00000000-0000-4000-8000-000000000001',
        teamAccessId: '00000000-0000-4000-8000-000000000021',
      }),
    ).toThrow();
  });

  it('通常構成では Better Auth ログインを使う', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ENABLE_DEV_OPERATOR_AUTH', 'false');

    expect(getLoginMode()).toBe('better-auth');
  });

  it('開発フラグ有効時は dev operator ログインを使う', () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_ENABLE_DEV_OPERATOR_AUTH', 'true');

    expect(getLoginMode()).toBe('dev-operator');
  });
});
