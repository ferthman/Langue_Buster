import type { DatabaseClient } from './client.js';
import { createDatabaseClient } from './client.js';
import { migratePhase7Schema } from './migrations.js';

type DatabaseRuntimeOptions = {
  pool?: DatabaseClient;
  connectionString?: string;
};

export type DatabaseRuntime = Readonly<{
  client: DatabaseClient;
  ready: Promise<void>;
  close(): Promise<void>;
}>;

export function createDatabaseRuntime(options: DatabaseRuntimeOptions): DatabaseRuntime {
  const client = options.pool ?? createDatabaseClient(requireConnectionString(options.connectionString));
  const ready = migratePhase7Schema(client);

  return {
    client,
    ready,
    async close() {
      await client.end();
    },
  };
}

function requireConnectionString(connectionString: string | undefined): string {
  if (!connectionString || connectionString.trim().length === 0) {
    throw new Error('POSTGRES_URL is required to initialize the API database runtime.');
  }

  return connectionString;
}
