import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments.js';

export const teams = pgTable(
  'teams',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    organization: text('organization'),
    pitId: text('pit_id'),
    contactEmail: text('contact_email'),
    displayContactName: text('display_contact_name'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [unique('teams_tournament_name_unique').on(t.tournamentId, t.name)],
);

export type TeamRow = typeof teams.$inferSelect;
export type InsertTeamRow = typeof teams.$inferInsert;
