type PostgresErrorLike = {
  code?: string;
  constraint_name?: string;
  constraint?: string;
};

export function isTeamsNameUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const pgError = err as PostgresErrorLike;
  if (pgError.code !== '23505') return false;
  return (
    pgError.constraint_name === 'teams_tournament_name_unique' ||
    pgError.constraint === 'teams_tournament_name_unique'
  );
}
