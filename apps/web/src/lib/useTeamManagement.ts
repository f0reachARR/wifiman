import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  apiQueryKeys,
  type DeviceSpecCreateInput,
  type DeviceSpecUpdateInput,
  type TeamUpdateInput,
  type WifiConfigCreateInput,
  type WifiConfigUpdateInput,
} from './api/client.js';

export function useTournaments() {
  return useQuery({
    queryKey: apiQueryKeys.tournaments,
    queryFn: () => apiClient.listTournaments(),
  });
}

export function useTournament(tournamentId: string) {
  return useQuery({
    queryKey: apiQueryKeys.tournament(tournamentId),
    queryFn: () => apiClient.getTournament(tournamentId),
    enabled: tournamentId.length > 0,
  });
}

export function useTournamentPublicOverview(tournamentId: string) {
  return useQuery({
    queryKey: apiQueryKeys.tournamentPublicOverview(tournamentId),
    queryFn: () => apiClient.getTournamentPublicOverview(tournamentId),
    enabled: tournamentId.length > 0,
  });
}

export function useTournamentNotices(tournamentId: string) {
  return useQuery({
    queryKey: apiQueryKeys.tournamentNotices(tournamentId),
    queryFn: () => apiClient.listTournamentNotices(tournamentId),
    enabled: tournamentId.length > 0,
  });
}

export function useTournamentBestPractices(tournamentId: string) {
  return useQuery({
    queryKey: apiQueryKeys.tournamentBestPractices(tournamentId),
    queryFn: () => apiClient.listTournamentBestPractices(tournamentId),
    enabled: tournamentId.length > 0,
  });
}

export function useTournamentTeams(tournamentId: string) {
  return useQuery({
    queryKey: apiQueryKeys.tournamentTeams(tournamentId),
    queryFn: () => apiClient.listTournamentTeams(tournamentId),
    enabled: tournamentId.length > 0,
  });
}

export function useTeam(teamId: string) {
  return useQuery({
    queryKey: apiQueryKeys.team(teamId),
    queryFn: () => apiClient.getTeam(teamId),
    enabled: teamId.length > 0,
  });
}

export function useTeamWifiConfigs(teamId: string) {
  return useQuery({
    queryKey: apiQueryKeys.teamWifiConfigs(teamId),
    queryFn: () => apiClient.listWifiConfigs(teamId),
    enabled: teamId.length > 0,
  });
}

export function useTeamDeviceSpecs(teamId: string, includeArchived: boolean) {
  return useQuery({
    queryKey: apiQueryKeys.teamDeviceSpecs(teamId, includeArchived),
    queryFn: () => apiClient.listDeviceSpecs(teamId, includeArchived),
    enabled: teamId.length > 0,
  });
}

export function useUpdateTeamMutation(teamId: string, tournamentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TeamUpdateInput) => apiClient.updateTeam(teamId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: apiQueryKeys.team(teamId) }),
        queryClient.invalidateQueries({ queryKey: apiQueryKeys.tournamentTeams(tournamentId) }),
      ]);
    },
  });
}

export function useCreateWifiConfigMutation(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: WifiConfigCreateInput) => apiClient.createWifiConfig(teamId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiQueryKeys.teamWifiConfigs(teamId) });
    },
  });
}

export function useUpdateWifiConfigMutation(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WifiConfigUpdateInput }) =>
      apiClient.updateWifiConfig(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiQueryKeys.teamWifiConfigs(teamId) });
    },
  });
}

export function useDisableWifiConfigMutation(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.disableWifiConfig(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiQueryKeys.teamWifiConfigs(teamId) });
    },
  });
}

export function useCreateDeviceSpecMutation(teamId: string, includeArchived: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeviceSpecCreateInput) => apiClient.createDeviceSpec(teamId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: apiQueryKeys.teamDeviceSpecs(teamId, includeArchived),
      });
    },
  });
}

export function useUpdateDeviceSpecMutation(teamId: string, includeArchived: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DeviceSpecUpdateInput }) =>
      apiClient.updateDeviceSpec(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: apiQueryKeys.teamDeviceSpecs(teamId, includeArchived),
      });
    },
  });
}

export function useArchiveDeviceSpecMutation(teamId: string, includeArchived: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.archiveDeviceSpec(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: apiQueryKeys.teamDeviceSpecs(teamId, includeArchived),
      });
      await queryClient.invalidateQueries({ queryKey: apiQueryKeys.teamWifiConfigs(teamId) });
    },
  });
}

export function useRestoreDeviceSpecMutation(teamId: string, includeArchived: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.restoreDeviceSpec(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: apiQueryKeys.teamDeviceSpecs(teamId, includeArchived),
      });
    },
  });
}
