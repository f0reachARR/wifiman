import { describe, expect, it } from 'vitest';
import { parseAuthSession } from './auth.js';
import {
  canEditTeamResources,
  canViewParticipantData,
  canViewTeamPrivateFields,
  isOwnTeam,
} from './authz.js';

describe('authz helpers', () => {
  const operatorSession = parseAuthSession({
    kind: 'operator',
    role: 'operator',
    sessionId: 'operator-session',
    displayName: 'Operator',
  });

  const editorSession = parseAuthSession({
    kind: 'team',
    role: 'editor',
    teamId: '00000000-0000-4000-8000-000000000011',
    tournamentId: '00000000-0000-4000-8000-000000000001',
    teamAccessId: '00000000-0000-4000-8000-000000000021',
  });

  const viewerSession = parseAuthSession({
    kind: 'team',
    role: 'viewer',
    teamId: '00000000-0000-4000-8000-000000000012',
    tournamentId: '00000000-0000-4000-8000-000000000001',
    teamAccessId: '00000000-0000-4000-8000-000000000022',
  });

  it('未認証は参加者向け詳細を見られない', () => {
    expect(canViewParticipantData(null)).toBe(false);
  });

  it('operator は任意チームの閲覧と編集ができる', () => {
    expect(canViewParticipantData(operatorSession)).toBe(true);
    expect(canViewTeamPrivateFields(operatorSession, 'team-x')).toBe(true);
    expect(canEditTeamResources(operatorSession, 'team-x')).toBe(true);
  });

  it('自チーム editor は編集できる', () => {
    expect(isOwnTeam(editorSession, '00000000-0000-4000-8000-000000000011')).toBe(true);
    expect(canViewTeamPrivateFields(editorSession, '00000000-0000-4000-8000-000000000011')).toBe(
      true,
    );
    expect(canEditTeamResources(editorSession, '00000000-0000-4000-8000-000000000011')).toBe(true);
  });

  it('他チーム viewer は閲覧専用で機微情報も見られない', () => {
    expect(canViewParticipantData(viewerSession)).toBe(true);
    expect(canViewTeamPrivateFields(viewerSession, '00000000-0000-4000-8000-000000000011')).toBe(
      false,
    );
    expect(canEditTeamResources(viewerSession, '00000000-0000-4000-8000-000000000011')).toBe(false);
  });
});
