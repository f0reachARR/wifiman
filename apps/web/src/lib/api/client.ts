import { type AuthSession, parseAuthSession } from '../auth.js';
import type { paths } from './generated/schema.js';

const AUTH_SESSION_PATH = '/auth/session';
const DEV_OPERATOR_SESSION_PATH = '/auth/dev-operator-session';
const VERIFY_TEAM_ACCESS_PATH = '/team-accesses/verify';

type AuthSessionContract =
  paths['/auth/session']['get']['responses'][200]['content']['application/json'];
type CreateDevOperatorSessionInput =
  paths['/auth/dev-operator-session']['post']['requestBody']['content']['application/json'];
type OperatorSessionContract =
  paths['/auth/dev-operator-session']['post']['responses'][200]['content']['application/json'];
type TeamSessionContract =
  paths['/team-accesses/verify']['post']['responses'][200]['content']['application/json'];
type VerifyTeamAccessInput =
  paths['/team-accesses/verify']['post']['requestBody']['content']['application/json'];

export class ApiClientError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.payload = payload;
  }
}

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? '/api';
}

export class ApiClient {
  private async requestJson<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    });

    return this.parseJsonResponse<TResponse>(response);
  }

  private async parseJsonResponse<T>(response: Response): Promise<T> {
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiClientError('API request failed', response.status, payload);
    }

    return payload as T;
  }

  async health() {
    const response = await fetch(`${getApiBaseUrl()}/health`, {
      credentials: 'include',
    });

    return this.parseJsonResponse<{ ok: boolean }>(response);
  }

  async getAuthSession(): Promise<AuthSession | null> {
    const response = await fetch(`${getApiBaseUrl()}${AUTH_SESSION_PATH}`, {
      credentials: 'include',
    });

    if (response.status === 401) {
      return null;
    }

    return parseAuthSession(await this.parseJsonResponse<AuthSessionContract>(response));
  }

  async signInDevOperator(displayName: string, passphrase: string): Promise<AuthSession> {
    const payload = await this.requestJson<OperatorSessionContract>(DEV_OPERATOR_SESSION_PATH, {
      method: 'POST',
      body: JSON.stringify({
        displayName,
        passphrase,
      } satisfies CreateDevOperatorSessionInput),
    });

    return parseAuthSession(payload);
  }

  async verifyTeamAccess(token: string): Promise<AuthSession> {
    const payload = await this.requestJson<TeamSessionContract>(VERIFY_TEAM_ACCESS_PATH, {
      method: 'POST',
      body: JSON.stringify({ token } satisfies VerifyTeamAccessInput),
    });

    return parseAuthSession(payload);
  }

  async clearAuthSession() {
    const response = await fetch(`${getApiBaseUrl()}${AUTH_SESSION_PATH}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (response.status !== 204) {
      await this.parseJsonResponse(response);
    }
  }

  async signOutOperator() {
    const response = await fetch(`${getApiBaseUrl()}/auth/sign-out`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      await this.parseJsonResponse(response);
    }
  }
}

export const apiClient = new ApiClient();

export const apiQueryKeys = {
  health: ['api', 'health'] as const,
  syncOverview: ['api', 'sync-overview'] as const,
};
