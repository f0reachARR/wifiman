import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments.js';

export const bestPractices = pgTable(
  'best_practices',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tournamentId: text('tournament_id').references(() => tournaments.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    scope: text('scope').$type<'general' | 'tournament' | 'band' | 'device'>().notNull(),
    targetBand: text('target_band').$type<'2.4GHz' | '5GHz' | '6GHz'>(),
    targetModel: text('target_model'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'best_practices_scope_check',
      sql`${t.scope} IN ('general', 'tournament', 'band', 'device')`,
    ),
    check(
      'best_practices_target_band_check',
      sql`${t.targetBand} IS NULL OR ${t.targetBand} IN ('2.4GHz', '5GHz', '6GHz')`,
    ),
    check(
      'best_practices_scope_target_check',
      sql`(
        (${t.scope} = 'general' AND ${t.tournamentId} IS NULL AND ${t.targetBand} IS NULL AND ${t.targetModel} IS NULL)
        OR (${t.scope} = 'tournament' AND ${t.tournamentId} IS NOT NULL AND ${t.targetBand} IS NULL AND ${t.targetModel} IS NULL)
        OR (${t.scope} = 'band' AND ${t.targetBand} IS NOT NULL AND ${t.targetModel} IS NULL)
        OR (${t.scope} = 'device' AND ${t.targetModel} IS NOT NULL)
      )`,
    ),
  ],
);

export type BestPracticeRow = typeof bestPractices.$inferSelect;
export type InsertBestPracticeRow = typeof bestPractices.$inferInsert;
