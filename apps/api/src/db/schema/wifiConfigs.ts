import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { deviceSpecs } from './deviceSpecs.js';
import { teams } from './teams.js';

export const wifiConfigs = pgTable(
  'wifi_configs',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    purpose: text('purpose').$type<'control' | 'video' | 'debug' | 'other'>().notNull(),
    band: text('band').$type<'2.4GHz' | '5GHz' | '6GHz'>().notNull(),
    channel: integer('channel').notNull(),
    channelWidthMHz: integer('channel_width_mhz').notNull(),
    role: text('role').$type<'primary' | 'backup'>().notNull(),
    status: text('status').$type<'active' | 'standby' | 'disabled'>().notNull().default('active'),
    apDeviceId: text('ap_device_id').references(() => deviceSpecs.id, { onDelete: 'set null' }),
    clientDeviceId: text('client_device_id').references(() => deviceSpecs.id, {
      onDelete: 'set null',
    }),
    expectedDistanceCategory: text('expected_distance_category').$type<'near' | 'mid' | 'far'>(),
    pingTargetIp: text('ping_target_ip'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'wifi_configs_purpose_check',
      sql`${t.purpose} IN ('control', 'video', 'debug', 'other')`,
    ),
    check('wifi_configs_band_check', sql`${t.band} IN ('2.4GHz', '5GHz', '6GHz')`),
    check('wifi_configs_channel_width_check', sql`${t.channelWidthMHz} IN (20, 40, 80, 160)`),
    check('wifi_configs_role_check', sql`${t.role} IN ('primary', 'backup')`),
    check('wifi_configs_status_check', sql`${t.status} IN ('active', 'standby', 'disabled')`),
    check(
      'wifi_configs_expected_distance_category_check',
      sql`${t.expectedDistanceCategory} IS NULL OR ${t.expectedDistanceCategory} IN ('near', 'mid', 'far')`,
    ),
  ],
);

export type WifiConfigRow = typeof wifiConfigs.$inferSelect;
export type InsertWifiConfigRow = typeof wifiConfigs.$inferInsert;
