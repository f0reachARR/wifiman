import type { AuthContext } from './middleware/auth.js';

export function hasParticipantRole(authCtx: AuthContext | undefined): boolean {
  if (authCtx?.userRole === 'operator') return true;
  return Boolean(authCtx?.teamId);
}

export function canViewTeam(authCtx: AuthContext | undefined, _targetTeamId: string): boolean {
  if (authCtx?.userRole === 'operator') return true;
  if (authCtx?.teamId) return true;
  return false;
}

export function canEditTeam(authCtx: AuthContext | undefined, targetTeamId: string): boolean {
  if (authCtx?.userRole === 'operator') return true;
  return Boolean(
    authCtx?.teamId && authCtx.teamId === targetTeamId && authCtx.teamAccessRole === 'editor',
  );
}

export type IssueReportCreateScope =
  | { kind: 'ok'; scopedTeamId: string | undefined }
  | { kind: 'unauthorized' }
  | { kind: 'forbidden' };

export function resolveIssueReportCreateScope(
  authCtx: AuthContext | undefined,
  requestedTeamId: string | undefined,
): IssueReportCreateScope {
  if (authCtx?.userRole === 'operator') {
    return { kind: 'ok', scopedTeamId: requestedTeamId };
  }

  if (authCtx?.teamId) {
    return { kind: 'ok', scopedTeamId: authCtx.teamId };
  }

  if (!authCtx?.userId) {
    return { kind: 'unauthorized' };
  }

  return { kind: 'forbidden' };
}
