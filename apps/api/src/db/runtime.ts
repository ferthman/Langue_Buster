import type { DatabaseClient } from './client.js';
import { createDatabaseClient } from './client.js';
import { migratePhase7Schema } from './migrations.js';

type DatabaseRuntimeOptions = {
  pool?: DatabaseClient;
  connectionString?: string;
};

type DatabaseEnvironment = Record<string, string | undefined>;

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

export function resolveDatabaseConnectionString(env: DatabaseEnvironment): string | undefined {
  const directConnectionString = firstNonEmpty(env.POSTGRES_URL, env.DATABASE_URL);
  if (directConnectionString) {
    return directConnectionString;
  }

  const host = env.PGHOST?.trim();
  const port = env.PGPORT?.trim();
  const database = env.PGDATABASE?.trim();
  const user = env.PGUSER?.trim();
  const password = env.PGPASSWORD?.trim();

  if (!host || !port || !database || !user) {
    return undefined;
  }

  const connectionString = new URL(`postgresql://${host}:${port}/${database}`);
  connectionString.username = user;
  if (password) {
    connectionString.password = password;
  }

  return connectionString.toString();
}

function requireConnectionString(connectionString: string | undefined): string {
  if (!connectionString || connectionString.trim().length === 0) {
    throw new Error(
      'A Postgres connection string is required to initialize the API database runtime. Set POSTGRES_URL or DATABASE_URL.',
    );
  }

  return connectionString;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}
