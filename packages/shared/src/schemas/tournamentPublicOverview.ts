import { z } from 'zod';
import { TournamentSchema } from './tournament.js';

export const TournamentPublicOverviewSchema = z.object({
  tournament: TournamentSchema,
  teamCount: z.number().int().nonnegative(),
  wifiConfigSummary: z.object({
    '2.4GHz': z.number().int().nonnegative(),
    '5GHz': z.number().int().nonnegative(),
    '6GHz': z.number().int().nonnegative(),
  }),
  publicIssueReportCount: z.number().int().nonnegative(),
  noticeCount: z.number().int().nonnegative(),
});

export type TournamentPublicOverview = z.infer<typeof TournamentPublicOverviewSchema>;
