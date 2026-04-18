import { z } from 'zod';
import { DateTimeStringSchema, optionalFromNullable } from './common.js';

export const TeamSchema = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid(),
  name: z.string().min(1).max(200),
  organization: optionalFromNullable(z.string().max(200)),
  pitId: optionalFromNullable(z.string().max(50)),
  contactEmail: optionalFromNullable(z.string().email().max(254)),
  displayContactName: optionalFromNullable(z.string().max(200)),
  notes: optionalFromNullable(z.string().max(2000)),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
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
