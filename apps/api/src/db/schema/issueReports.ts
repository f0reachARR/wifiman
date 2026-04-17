import { sql } from 'drizzle-orm';
import { boolean, integer, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments.js';

export const issueReports = pgTable('issue_reports', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: text('tournament_id')
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  teamId: text('team_id'),
  wifiConfigId: text('wifi_config_id'),
  reporterName: text('reporter_name'),
  syncStatus: text('sync_status')
    .$type<'local_only' | 'pending' | 'synced' | 'failed'>()
    .notNull()
    .default('synced'),
  band: text('band').$type<'2.4GHz' | '5GHz' | '6GHz'>().notNull(),
  channel: integer('channel').notNull(),
  channelWidthMHz: integer('channel_width_mhz'),
  symptom: text('symptom')
    .$type<
      | 'cannot_connect'
      | 'unstable'
      | 'low_throughput'
      | 'high_latency'
      | 'disconnect'
      | 'distance_sensitive'
      | 'unknown'
    >()
    .notNull(),
  severity: text('severity').$type<'low' | 'medium' | 'high' | 'critical'>().notNull(),
  avgPingMs: real('avg_ping_ms'),
  maxPingMs: real('max_ping_ms'),
  packetLossPercent: real('packet_loss_percent'),
  distanceCategory: text('distance_category').$type<'near' | 'mid' | 'far' | 'obstacle'>(),
  estimatedDistanceMeters: real('estimated_distance_meters'),
  locationLabel: text('location_label'),
  reproducibility: text('reproducibility').$type<'always' | 'sometimes' | 'once'>(),
  description: text('description'),
  mitigationTried: text('mitigation_tried'), // JSON array stored as text
  improved: boolean('improved'),
  apDeviceModel: text('ap_device_model'),
  clientDeviceModel: text('client_device_model'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type IssueReportRow = typeof issueReports.$inferSelect;
export type InsertIssueReportRow = typeof issueReports.$inferInsert;
