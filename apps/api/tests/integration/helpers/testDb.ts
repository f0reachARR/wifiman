import { PGlite } from '@electric-sql/pglite';
import { pushSchema } from 'drizzle-kit/api';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../../src/db/schema/index.js';

function createDrizzleDb(client: PGlite) {
  return drizzle(client, { schema });
}

export type TestDatabase = {
  client: PGlite;
  db: ReturnType<typeof createDrizzleDb>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
};

export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  const db = createDrizzleDb(client);
  const pgDb = db as unknown as PgDatabase<PgQueryResultHKT>;

  const push = await pushSchema(schema, pgDb);
  await push.apply();

  return {
    client,
    db,
    reset: async () => {
      await client.exec('DROP SCHEMA IF EXISTS public CASCADE;');
      await client.exec('CREATE SCHEMA public;');
      const resetPush = await pushSchema(schema, pgDb);
      await resetPush.apply();
    },
    close: async () => {
      await client.close();
    },
  };
}
