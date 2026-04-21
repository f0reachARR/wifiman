import type { AuthSession } from './auth.js';

export function isOperatorSession(session: AuthSession | null | undefined): boolean {
  return session?.kind === 'operator';
}

export function isTeamSession(session: AuthSession | null | undefined): boolean {
  return session?.kind === 'team';
}

export function isOwnTeam(session: AuthSession | null | undefined, teamId: string): boolean {
  return Boolean(session?.kind === 'team' && session.teamId === teamId);
}

export function canViewParticipantData(session: AuthSession | null | undefined): boolean {
  return Boolean(session);
}

export function canViewTeamPrivateFields(
  session: AuthSession | null | undefined,
  teamId: string,
): boolean {
  return isOperatorSession(session) || isOwnTeam(session, teamId);
}

export function canEditTeamResources(
  session: AuthSession | null | undefined,
  teamId: string,
): boolean {
  return (
    isOperatorSession(session) ||
    Boolean(session?.kind === 'team' && session.teamId === teamId && session.role === 'editor')
  );
}

export function resolveSessionTournamentId(session: AuthSession | null | undefined): string | null {
  if (!session || session.kind !== 'team') {
    return null;
  }
  return session.tournamentId;
}
