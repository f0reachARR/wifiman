import {
  BestPracticeSchema,
  ChannelMapEntrySchema,
  DeviceSpecSchema,
  IssueReportSchema,
  NoticeSchema,
  PublicIssueReportSummarySchema,
  TeamSchema,
  TournamentPublicOverviewSchema,
  TournamentSchema,
  WifiConfigSchema,
} from '@wifiman/shared';
import { z } from 'zod';
import { type AuthSession, parseAuthSession } from '../auth.js';
import type { paths } from './generated/schema.js';

const AUTH_SESSION_PATH = '/auth/session';
const DEV_OPERATOR_SESSION_PATH = '/auth/dev-operator-session';
const VERIFY_TEAM_ACCESS_PATH = '/team-accesses/verify';

const PublicTeamSchema = TeamSchema.omit({
  contactEmail: true,
  displayContactName: true,
  notes: true,
});
const TeamViewSchema = z.union([TeamSchema, PublicTeamSchema]);

const PublicWifiConfigSchema = WifiConfigSchema.omit({
  pingTargetIp: true,
  notes: true,
});
const WifiConfigViewSchema = z.union([WifiConfigSchema, PublicWifiConfigSchema]);

const PublicDeviceSpecSchema = DeviceSpecSchema.omit({
  notes: true,
  archivedAt: true,
});
const DeviceSpecViewSchema = z.union([DeviceSpecSchema, PublicDeviceSpecSchema]);
const IssueReportViewSchema = z.union([IssueReportSchema, PublicIssueReportSummarySchema]);

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
type TournamentContract =
  paths['/tournaments/{id}']['get']['responses'][200]['content']['application/json'];
type TournamentListContract =
  paths['/tournaments']['get']['responses'][200]['content']['application/json'];
type TournamentPublicOverviewContract =
  paths['/tournaments/{id}/public-overview']['get']['responses'][200]['content']['application/json'];
type NoticeListContract =
  paths['/tournaments/{tournamentId}/notices']['get']['responses'][200]['content']['application/json'];
type BestPracticeListContract =
  paths['/tournaments/{tournamentId}/best-practices']['get']['responses'][200]['content']['application/json'];
type ChannelMapListContract =
  paths['/tournaments/{tournamentId}/channel-map']['get']['responses'][200]['content']['application/json'];
type IssueReportListContract =
  paths['/tournaments/{tournamentId}/issue-reports']['get']['responses'][200]['content']['application/json'];
type CreateIssueReportInput =
  paths['/tournaments/{tournamentId}/issue-reports']['post']['requestBody']['content']['application/json'];
type IssueReportContract =
  paths['/tournaments/{tournamentId}/issue-reports']['post']['responses'][201]['content']['application/json'];
type IssueReportDetailContract =
  paths['/issue-reports/{id}']['get']['responses'][200]['content']['application/json'];
type UpdateIssueReportInput =
  paths['/issue-reports/{id}']['patch']['requestBody']['content']['application/json'];
type UpdateIssueReportContract =
  paths['/issue-reports/{id}']['patch']['responses'][200]['content']['application/json'];
type TeamListContract =
  paths['/tournaments/{tournamentId}/teams']['get']['responses'][200]['content']['application/json'];
type TeamContract =
  paths['/teams/{teamId}']['get']['responses'][200]['content']['application/json'];
type UpdateTeamInput =
  paths['/teams/{teamId}']['patch']['requestBody']['content']['application/json'];
type WifiConfigListContract =
  paths['/teams/{teamId}/wifi-configs']['get']['responses'][200]['content']['application/json'];
type CreateWifiConfigInput =
  paths['/teams/{teamId}/wifi-configs']['post']['requestBody']['content']['application/json'];
type WifiConfigContract =
  | paths['/teams/{teamId}/wifi-configs']['post']['responses'][201]['content']['application/json']
  | paths['/wifi-configs/{id}']['patch']['responses'][200]['content']['application/json'];
type PatchWifiConfigInput =
  paths['/wifi-configs/{id}']['patch']['requestBody']['content']['application/json'];
type DeviceSpecListContract =
  paths['/teams/{teamId}/device-specs']['get']['responses'][200]['content']['application/json'];
type CreateDeviceSpecInput =
  paths['/teams/{teamId}/device-specs']['post']['requestBody']['content']['application/json'];
type DeviceSpecContract =
  | paths['/teams/{teamId}/device-specs']['post']['responses'][201]['content']['application/json']
  | paths['/device-specs/{id}']['patch']['responses'][200]['content']['application/json'];
type PatchDeviceSpecInput =
  paths['/device-specs/{id}']['patch']['requestBody']['content']['application/json'];

export type TournamentView = z.infer<typeof TournamentSchema>;
export type TournamentPublicOverviewView = z.infer<typeof TournamentPublicOverviewSchema>;
export type NoticeView = z.infer<typeof NoticeSchema>;
export type BestPracticeView = z.infer<typeof BestPracticeSchema>;
export type ChannelMapEntryView = z.infer<typeof ChannelMapEntrySchema>;
export type TeamView = TeamContract;
export type WifiConfigView = WifiConfigListContract[number];
export type DeviceSpecView = DeviceSpecListContract[number];
export type IssueReportView = IssueReportListContract[number];
export type IssueReportCreateInput = CreateIssueReportInput;
export type IssueReportUpdateInput = UpdateIssueReportInput;
export type TeamUpdateInput = UpdateTeamInput;
export type WifiConfigCreateInput = CreateWifiConfigInput;
export type WifiConfigUpdateInput = PatchWifiConfigInput;
export type DeviceSpecCreateInput = CreateDeviceSpecInput;
export type DeviceSpecUpdateInput = PatchDeviceSpecInput;

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

function withSearchParams(path: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query.length > 0 ? `${path}?${query}` : path;
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

  async listTournaments(): Promise<TournamentView[]> {
    const payload = await this.requestJson<TournamentListContract>('/tournaments');
    return z.array(TournamentSchema).parse(payload);
  }

  async getTournament(id: string): Promise<TournamentView> {
    const payload = await this.requestJson<TournamentContract>(`/tournaments/${id}`);
    return TournamentSchema.parse(payload);
  }

  async getTournamentPublicOverview(id: string): Promise<TournamentPublicOverviewView> {
    const payload = await this.requestJson<TournamentPublicOverviewContract>(
      `/tournaments/${id}/public-overview`,
    );
    return TournamentPublicOverviewSchema.parse(payload);
  }

  async listTournamentNotices(tournamentId: string): Promise<NoticeView[]> {
    const payload = await this.requestJson<NoticeListContract>(
      `/tournaments/${tournamentId}/notices`,
    );
    return z.array(NoticeSchema).parse(payload);
  }

  async listTournamentBestPractices(tournamentId: string): Promise<BestPracticeView[]> {
    const payload = await this.requestJson<BestPracticeListContract>(
      `/tournaments/${tournamentId}/best-practices`,
    );
    return z.array(BestPracticeSchema).parse(payload);
  }

  async listTournamentChannelMap(tournamentId: string): Promise<ChannelMapEntryView[]> {
    const payload = await this.requestJson<ChannelMapListContract>(
      `/tournaments/${tournamentId}/channel-map`,
    );
    return z.array(ChannelMapEntrySchema).parse(payload) as ChannelMapEntryView[];
  }

  async listTournamentIssueReports(tournamentId: string): Promise<IssueReportView[]> {
    const payload = await this.requestJson<IssueReportListContract>(
      `/tournaments/${tournamentId}/issue-reports`,
    );
    return z.array(IssueReportViewSchema).parse(payload) as IssueReportView[];
  }

  async createIssueReport(
    tournamentId: string,
    input: IssueReportCreateInput,
  ): Promise<z.infer<typeof IssueReportSchema>> {
    const payload = await this.requestJson<IssueReportContract>(
      `/tournaments/${tournamentId}/issue-reports`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
    return IssueReportSchema.parse(payload);
  }

  async getIssueReport(id: string): Promise<IssueReportView> {
    const payload = await this.requestJson<IssueReportDetailContract>(`/issue-reports/${id}`);
    return IssueReportViewSchema.parse(payload) as IssueReportView;
  }

  async updateIssueReport(
    id: string,
    input: IssueReportUpdateInput,
  ): Promise<z.infer<typeof IssueReportSchema>> {
    const payload = await this.requestJson<UpdateIssueReportContract>(`/issue-reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input as UpdateIssueReportInput),
    });
    return IssueReportSchema.parse(payload);
  }

  async listTournamentTeams(tournamentId: string): Promise<TeamView[]> {
    const payload = await this.requestJson<TeamListContract>(`/tournaments/${tournamentId}/teams`);
    return z.array(TeamViewSchema).parse(payload) as TeamView[];
  }

  async getTeam(teamId: string): Promise<TeamView> {
    const payload = await this.requestJson<TeamContract>(`/teams/${teamId}`);
    return TeamViewSchema.parse(payload) as TeamView;
  }

  async updateTeam(teamId: string, input: TeamUpdateInput): Promise<z.infer<typeof TeamSchema>> {
    const payload = await this.requestJson<TeamContract>(`/teams/${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify(input as UpdateTeamInput),
    });
    return TeamSchema.parse(payload);
  }

  async listWifiConfigs(teamId: string): Promise<WifiConfigView[]> {
    const payload = await this.requestJson<WifiConfigListContract>(`/teams/${teamId}/wifi-configs`);
    return z.array(WifiConfigViewSchema).parse(payload) as WifiConfigView[];
  }

  async createWifiConfig(
    teamId: string,
    input: WifiConfigCreateInput,
  ): Promise<z.infer<typeof WifiConfigSchema>> {
    const payload = await this.requestJson<WifiConfigContract>(`/teams/${teamId}/wifi-configs`, {
      method: 'POST',
      body: JSON.stringify(input as CreateWifiConfigInput),
    });
    return WifiConfigSchema.parse(payload);
  }

  async updateWifiConfig(
    id: string,
    input: WifiConfigUpdateInput,
  ): Promise<z.infer<typeof WifiConfigSchema>> {
    const payload = await this.requestJson<WifiConfigContract>(`/wifi-configs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input as PatchWifiConfigInput),
    });
    return WifiConfigSchema.parse(payload);
  }

  async disableWifiConfig(id: string) {
    await this.requestJson<{ message: string }>(`/wifi-configs/${id}`, {
      method: 'DELETE',
    });
  }

  async listDeviceSpecs(teamId: string, includeArchived = false): Promise<DeviceSpecView[]> {
    const searchParams = new URLSearchParams();
    if (includeArchived) {
      searchParams.set('include_archived', 'true');
    }
    const payload = await this.requestJson<DeviceSpecListContract>(
      withSearchParams(`/teams/${teamId}/device-specs`, searchParams),
    );
    return z.array(DeviceSpecViewSchema).parse(payload) as DeviceSpecView[];
  }

  async createDeviceSpec(
    teamId: string,
    input: DeviceSpecCreateInput,
  ): Promise<z.infer<typeof DeviceSpecSchema>> {
    const payload = await this.requestJson<DeviceSpecContract>(`/teams/${teamId}/device-specs`, {
      method: 'POST',
      body: JSON.stringify(input as CreateDeviceSpecInput),
    });
    return DeviceSpecSchema.parse(payload);
  }

  async updateDeviceSpec(
    id: string,
    input: DeviceSpecUpdateInput,
  ): Promise<z.infer<typeof DeviceSpecSchema>> {
    const payload = await this.requestJson<DeviceSpecContract>(`/device-specs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input as PatchDeviceSpecInput),
    });
    return DeviceSpecSchema.parse(payload);
  }

  async archiveDeviceSpec(id: string) {
    await this.requestJson<{ id: string; message: string }>(`/device-specs/${id}`, {
      method: 'DELETE',
    });
  }

  async restoreDeviceSpec(id: string) {
    await this.requestJson<{ id: string; message: string }>(`/device-specs/${id}/restore`, {
      method: 'POST',
    });
  }
}

export const apiClient = new ApiClient();

export const apiQueryKeys = {
  health: ['api', 'health'] as const,
  syncOverview: ['api', 'sync-overview'] as const,
  tournaments: ['api', 'tournaments'] as const,
  tournament: (id: string) => ['api', 'tournaments', id] as const,
  tournamentPublicOverview: (id: string) => ['api', 'tournaments', id, 'public-overview'] as const,
  tournamentNotices: (id: string) => ['api', 'tournaments', id, 'notices'] as const,
  tournamentBestPractices: (id: string) => ['api', 'tournaments', id, 'best-practices'] as const,
  tournamentChannelMap: (id: string) => ['api', 'tournaments', id, 'channel-map'] as const,
  tournamentIssueReports: (id: string) => ['api', 'tournaments', id, 'issue-reports'] as const,
  issueReport: (id: string) => ['api', 'issue-reports', id] as const,
  tournamentTeams: (id: string) => ['api', 'tournaments', id, 'teams'] as const,
  team: (id: string) => ['api', 'teams', id] as const,
  teamWifiConfigs: (id: string) => ['api', 'teams', id, 'wifi-configs'] as const,
  teamDeviceSpecs: (id: string, includeArchived: boolean) =>
    ['api', 'teams', id, 'device-specs', includeArchived] as const,
};
