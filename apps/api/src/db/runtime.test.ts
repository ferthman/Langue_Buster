import { describe, expect, it } from 'vitest';

import { resolveDatabaseConnectionString } from './runtime.js';

describe('resolveDatabaseConnectionString', () => {
  it('prefers POSTGRES_URL when present', () => {
    const connectionString = resolveDatabaseConnectionString({
      POSTGRES_URL: 'postgres://postgres-url/runtime',
      DATABASE_URL: 'postgres://database-url/runtime',
    });

    expect(connectionString).toBe('postgres://postgres-url/runtime');
  });

  it('falls back to DATABASE_URL when POSTGRES_URL is absent', () => {
    const connectionString = resolveDatabaseConnectionString({
      DATABASE_URL: 'postgres://database-url/runtime',
    });

    expect(connectionString).toBe('postgres://database-url/runtime');
  });

  it('builds a connection string from PG* variables when direct URLs are absent', () => {
    const connectionString = resolveDatabaseConnectionString({
      PGHOST: 'db.example.internal',
      PGPORT: '5432',
      PGDATABASE: 'langue_buster',
      PGUSER: 'service-user',
      PGPASSWORD: 'secret:value',
    });

    expect(connectionString).toBe(
      'postgresql://service-user:secret%3Avalue@db.example.internal:5432/langue_buster',
    );
  });

  it('returns undefined when the runtime environment is incomplete', () => {
    const connectionString = resolveDatabaseConnectionString({
      PGHOST: 'db.example.internal',
      PGPORT: '5432',
      PGDATABASE: 'langue_buster',
    });

    expect(connectionString).toBeUndefined();
  });
});
