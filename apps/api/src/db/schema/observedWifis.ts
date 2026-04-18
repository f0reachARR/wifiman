import { sql } from 'drizzle-orm';
import { check, integer, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments.js';

export const observedWifis = pgTable(
  'observed_wifis',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    source: text('source').$type<'wild' | 'analyzer_import' | 'manual'>().notNull(),
    ssid: text('ssid'),
    bssid: text('bssid'),
    band: text('band').$type<'2.4GHz' | '5GHz' | '6GHz'>().notNull(),
    channel: integer('channel').notNull(),
    channelWidthMHz: integer('channel_width_mhz'),
    rssi: real('rssi'),
    locationLabel: text('location_label'),
    observedAt: timestamp('observed_at').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('observed_wifis_source_check', sql`${t.source} IN ('wild', 'analyzer_import', 'manual')`),
    check('observed_wifis_band_check', sql`${t.band} IN ('2.4GHz', '5GHz', '6GHz')`),
  ],
);

export type ObservedWifiRow = typeof observedWifis.$inferSelect;
export type InsertObservedWifiRow = typeof observedWifis.$inferInsert;
