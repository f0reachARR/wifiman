import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';
import { tournaments } from './tournaments.js';
import { wifiConfigs } from './wifiConfigs.js';

export const issueReports = pgTable(
  'issue_reports',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }),
    wifiConfigId: text('wifi_config_id').references(() => wifiConfigs.id, { onDelete: 'set null' }),
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
    mitigationTried: text('mitigation_tried').array(),
    improved: boolean('improved'),
    apDeviceModel: text('ap_device_model'),
    clientDeviceModel: text('client_device_model'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'issue_reports_sync_status_check',
      sql`${t.syncStatus} IN ('local_only', 'pending', 'synced', 'failed')`,
    ),
    check('issue_reports_band_check', sql`${t.band} IN ('2.4GHz', '5GHz', '6GHz')`),
    check(
      'issue_reports_symptom_check',
      sql`${t.symptom} IN ('cannot_connect', 'unstable', 'low_throughput', 'high_latency', 'disconnect', 'distance_sensitive', 'unknown')`,
    ),
    check(
      'issue_reports_severity_check',
      sql`${t.severity} IN ('low', 'medium', 'high', 'critical')`,
    ),
    check(
      'issue_reports_distance_category_check',
      sql`${t.distanceCategory} IS NULL OR ${t.distanceCategory} IN ('near', 'mid', 'far', 'obstacle')`,
    ),
    check(
      'issue_reports_reproducibility_check',
      sql`${t.reproducibility} IS NULL OR ${t.reproducibility} IN ('always', 'sometimes', 'once')`,
    ),
    check(
      'issue_reports_packet_loss_percent_check',
      sql`${t.packetLossPercent} IS NULL OR (${t.packetLossPercent} >= 0 AND ${t.packetLossPercent} <= 100)`,
    ),
  ],
);

export type IssueReportRow = typeof issueReports.$inferSelect;
export type InsertIssueReportRow = typeof issueReports.$inferInsert;
