import { describe, expect, it } from 'vitest';
import { isTeamsNameUniqueViolation } from '../../src/routes/teamErrors.js';

describe('isTeamsNameUniqueViolation', () => {
  it('SQLSTATE 23505 かつ対象制約名なら true', () => {
    expect(
      isTeamsNameUniqueViolation({
        code: '23505',
        constraint_name: 'teams_tournament_name_unique',
      }),
    ).toBe(true);

    expect(
      isTeamsNameUniqueViolation({ code: '23505', constraint: 'teams_tournament_name_unique' }),
    ).toBe(true);
  });

  it('制約名または SQLSTATE が一致しなければ false', () => {
    expect(isTeamsNameUniqueViolation({ code: '23505', constraint_name: 'other_unique' })).toBe(
      false,
    );
    expect(
      isTeamsNameUniqueViolation({
        code: '22001',
        constraint_name: 'teams_tournament_name_unique',
      }),
    ).toBe(false);
    expect(isTeamsNameUniqueViolation(new Error('duplicate key'))).toBe(false);
  });
});
