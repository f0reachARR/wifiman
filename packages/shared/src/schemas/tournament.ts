import { z } from 'zod';
import { DateTimeStringSchema, optionalFromNullable } from './common.js';

export const TournamentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  venueName: z.string().min(1).max(200),
  startDate: z.string().date(),
  endDate: z.string().date(),
  description: optionalFromNullable(z.string().max(2000)),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

export const CreateTournamentSchema = TournamentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateTournamentSchema = CreateTournamentSchema.partial();

export type Tournament = z.infer<typeof TournamentSchema>;
export type CreateTournament = z.infer<typeof CreateTournamentSchema>;
export type UpdateTournament = z.infer<typeof UpdateTournamentSchema>;
