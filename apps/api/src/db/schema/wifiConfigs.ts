import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';

export const wifiConfigs = pgTable('wifi_configs', {
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
  apDeviceId: text('ap_device_id'),
  clientDeviceId: text('client_device_id'),
  expectedDistanceCategory: text('expected_distance_category').$type<'near' | 'mid' | 'far'>(),
  pingTargetIp: text('ping_target_ip'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type WifiConfigRow = typeof wifiConfigs.$inferSelect;
export type InsertWifiConfigRow = typeof wifiConfigs.$inferInsert;
