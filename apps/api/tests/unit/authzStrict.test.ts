import { describe, expect, it } from 'vitest';
import {
  canEditTeam,
  canViewTeam,
  hasParticipantRole,
  resolveIssueReportCreateScope,
} from '../../src/authz.js';

describe('authz strict policies', () => {
  it('participant 判定は operator または team token のみ true', () => {
    expect(hasParticipantRole({ userRole: 'operator' })).toBe(true);
    expect(hasParticipantRole({ teamId: 'team-a', teamAccessRole: 'viewer' })).toBe(true);
    expect(hasParticipantRole({ userId: 'user-a', userRole: 'user' })).toBe(false);
  });

  it('team_viewer は operator または同一 team の viewer/editor のみ', () => {
    expect(canViewTeam({ userRole: 'operator' }, 'team-x')).toBe(true);
    expect(canViewTeam({ teamId: 'team-a', teamAccessRole: 'viewer' }, 'team-a')).toBe(true);
    expect(canViewTeam({ teamId: 'team-a', teamAccessRole: 'editor' }, 'team-a')).toBe(true);
    expect(canViewTeam({ teamId: 'team-a', teamAccessRole: 'viewer' }, 'team-x')).toBe(false);
    expect(canViewTeam({ userId: 'user-a', userRole: 'user' }, 'team-x')).toBe(false);
  });

  it('team_editor は operator または同一 team editor のみ', () => {
    expect(canEditTeam({ userRole: 'operator' }, 'team-x')).toBe(true);
    expect(canEditTeam({ teamId: 'team-a', teamAccessRole: 'editor' }, 'team-a')).toBe(true);
    expect(canEditTeam({ teamId: 'team-a', teamAccessRole: 'viewer' }, 'team-a')).toBe(false);
    expect(canEditTeam({ teamId: 'team-a', teamAccessRole: 'editor' }, 'team-b')).toBe(false);
  });

  it('IssueReport 作成: editor は自チームへ強制、viewer は forbidden', () => {
    expect(
      resolveIssueReportCreateScope(
        { teamId: 'team-a', teamAccessRole: 'editor' },
        'spoofed-team-id',
      ),
    ).toEqual({ kind: 'ok', scopedTeamId: 'team-a' });

    expect(
      resolveIssueReportCreateScope({ teamId: 'team-a', teamAccessRole: 'viewer' }, 'team-a'),
    ).toEqual({ kind: 'forbidden' });
  });
});
