import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';

export const deviceSpecs = pgTable('device_specs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: text('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  vendor: text('vendor'),
  model: text('model').notNull(),
  kind: text('kind')
    .$type<'ap' | 'client' | 'usb_dongle' | 'router' | 'bridge' | 'other'>()
    .notNull(),
  supportedBands: text('supported_bands').notNull(), // JSON array stored as text
  notes: text('notes'),
  knownIssues: text('known_issues'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type DeviceSpecRow = typeof deviceSpecs.$inferSelect;
export type InsertDeviceSpecRow = typeof deviceSpecs.$inferInsert;
