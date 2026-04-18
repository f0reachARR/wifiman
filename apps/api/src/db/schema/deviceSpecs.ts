import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';

export const deviceSpecs = pgTable(
  'device_specs',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    vendor: text('vendor'),
    model: text('model').notNull(),
    kind: text('kind')
      .$type<'ap' | 'client' | 'usb_dongle' | 'router' | 'bridge' | 'other'>()
      .notNull(),
    supportedBands: text('supported_bands').array().notNull(),
    notes: text('notes'),
    knownIssues: text('known_issues'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    archivedAt: timestamp('archived_at'),
  },
  (t) => [
    check(
      'device_specs_kind_check',
      sql`${t.kind} IN ('ap', 'client', 'usb_dongle', 'router', 'bridge', 'other')`,
    ),
    check(
      'device_specs_supported_bands_not_empty_check',
      sql`array_length(${t.supportedBands}, 1) >= 1`,
    ),
    check(
      'device_specs_supported_bands_values_check',
      sql`${t.supportedBands} <@ ARRAY['2.4GHz', '5GHz', '6GHz']::text[]`,
    ),
  ],
);

export type DeviceSpecRow = typeof deviceSpecs.$inferSelect;
export type InsertDeviceSpecRow = typeof deviceSpecs.$inferInsert;
