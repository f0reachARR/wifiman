import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';

export const teamAccesses = pgTable(
  'team_accesses',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    accessTokenHash: text('access_token_hash').notNull().unique(),
    issuedAt: timestamp('issued_at').notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
    role: text('role').$type<'editor' | 'viewer'>().notNull().default('editor'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [check('team_accesses_role_check', sql`${t.role} IN ('editor', 'viewer')`)],
);

export type TeamAccessRow = typeof teamAccesses.$inferSelect;
export type InsertTeamAccessRow = typeof teamAccesses.$inferInsert;
