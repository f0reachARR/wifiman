import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const syncRecords = pgTable('sync_records', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').$type<'create' | 'update' | 'delete'>().notNull(),
  status: text('status')
    .$type<'pending' | 'processing' | 'failed' | 'done'>()
    .notNull()
    .default('pending'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type SyncRecordRow = typeof syncRecords.$inferSelect;
export type InsertSyncRecordRow = typeof syncRecords.$inferInsert;
