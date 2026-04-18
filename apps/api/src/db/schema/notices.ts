import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments.js';

export const notices = pgTable(
  'notices',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    severity: text('severity').$type<'info' | 'warning' | 'critical'>().notNull(),
    publishedAt: timestamp('published_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [check('notices_severity_check', sql`${t.severity} IN ('info', 'warning', 'critical')`)],
);

export type NoticeRow = typeof notices.$inferSelect;
export type InsertNoticeRow = typeof notices.$inferInsert;
