import { z } from 'zod';

export const TeamSchema = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid(),
  name: z.string().min(1).max(200),
  organization: z.string().max(200).optional(),
  pitId: z.string().max(50).optional(),
  contactEmail: z.string().email().max(254).optional(),
  displayContactName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateTeamSchema = TeamSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateTeamSchema = CreateTeamSchema.omit({ tournamentId: true }).partial();

export type Team = z.infer<typeof TeamSchema>;
export type CreateTeam = z.infer<typeof CreateTeamSchema>;
export type UpdateTeam = z.infer<typeof UpdateTeamSchema>;
