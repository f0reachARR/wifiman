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

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

export class ApiClient {
  constructor(private readonly baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api') {}

  async request<T>(path: string, options: ApiRequestOptions = {}) {
    const { body, headers, ...init } = options;
    const requestInit: RequestInit = {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(headers ?? {}),
      },
    };

    if (body !== undefined) {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, requestInit);

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiClientError('API request failed', response.status, payload);
    }

    return payload as T;
  }

  async health() {
    return this.request<{ ok: boolean }>('/health', { method: 'GET' });
  }
}

export const apiClient = new ApiClient();

export const apiQueryKeys = {
  health: ['api', 'health'] as const,
  syncOverview: ['api', 'sync-overview'] as const,
};
