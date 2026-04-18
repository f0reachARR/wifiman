type PostgresErrorLike = {
  code?: string;
  constraint_name?: string;
  constraint?: string;
  cause?: unknown;
};

export function isTeamsNameUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const pgError = err as PostgresErrorLike;
  const candidate =
    pgError.code === '23505'
      ? pgError
      : ((pgError.cause as PostgresErrorLike | undefined) ?? pgError);
  if (!candidate || typeof candidate !== 'object') return false;
  if (candidate.code !== '23505') return false;
  return (
    candidate.constraint_name === 'teams_tournament_name_unique' ||
    candidate.constraint === 'teams_tournament_name_unique'
  );
}
