import { describe, expect, it } from 'vitest';
import {
  canEditTeam,
  canViewTeam,
  hasParticipantRole,
  resolveIssueReportCreateScope,
} from '../../src/authz.js';

describe('authz policies', () => {
  it('参加者判定: operator と team token は true、通常ログインのみは false', () => {
    expect(hasParticipantRole({ userRole: 'operator' })).toBe(true);
    expect(hasParticipantRole({ teamId: 'team-a', teamAccessRole: 'viewer' })).toBe(true);
    expect(hasParticipantRole({ userId: 'user-a', userRole: 'user' })).toBe(false);
  });

  it('team_viewer: 参加者なら他チーム閲覧可、通常ログインのみは不可', () => {
    expect(canViewTeam({ userRole: 'operator' }, 'team-x')).toBe(true);
    expect(canViewTeam({ teamId: 'team-a', teamAccessRole: 'viewer' }, 'team-x')).toBe(true);
    expect(canViewTeam({ userId: 'user-a', userRole: 'user' }, 'team-x')).toBe(false);
  });

  it('team_editor: operator または同一 team の editor のみ可', () => {
    expect(canEditTeam({ userRole: 'operator' }, 'team-x')).toBe(true);
    expect(canEditTeam({ teamId: 'team-a', teamAccessRole: 'editor' }, 'team-a')).toBe(true);
    expect(canEditTeam({ teamId: 'team-a', teamAccessRole: 'viewer' }, 'team-a')).toBe(false);
    expect(canEditTeam({ teamId: 'team-a', teamAccessRole: 'editor' }, 'team-b')).toBe(false);
  });

  it('IssueReport 作成スコープ: participant は teamId を偽装できず、自チームへ強制される', () => {
    expect(
      resolveIssueReportCreateScope(
        { teamId: 'team-a', teamAccessRole: 'editor' },
        'spoofed-team-id',
      ),
    ).toEqual({ kind: 'ok', scopedTeamId: 'team-a' });
  });

  it('IssueReport 作成スコープ: operator はリクエスト teamId を使える', () => {
    expect(resolveIssueReportCreateScope({ userRole: 'operator' }, 'team-op')).toEqual({
      kind: 'ok',
      scopedTeamId: 'team-op',
    });
  });

  it('IssueReport 作成スコープ: 通常ログインのみは forbidden、未認証は unauthorized', () => {
    expect(resolveIssueReportCreateScope({ userId: 'user-a', userRole: 'user' }, 'team-a')).toEqual(
      {
        kind: 'forbidden',
      },
    );
    expect(resolveIssueReportCreateScope(undefined, 'team-a')).toEqual({ kind: 'unauthorized' });
  });
});
