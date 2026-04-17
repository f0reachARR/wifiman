import { z } from 'zod';

export const TournamentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  venueName: z.string().min(1).max(200),
  startDate: z.string().date(),
  endDate: z.string().date(),
  description: z.string().max(2000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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
