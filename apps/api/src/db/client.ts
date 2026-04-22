import { Pool, type QueryResult, type QueryResultRow } from 'pg';

export type DatabaseClient = Pick<Pool, 'query' | 'end'>;

export function createDatabaseClient(connectionString: string): DatabaseClient {
  return new Pool({
    connectionString,
  });
}

export async function queryRows<Row extends QueryResultRow>(
  client: Pick<DatabaseClient, 'query'>,
  text: string,
  values: readonly unknown[] = [],
): Promise<readonly Row[]> {
  const result = await client.query<Row>(text, [...values]);
  return result.rows;
}

export async function queryOne<Row extends QueryResultRow>(
  client: Pick<DatabaseClient, 'query'>,
  text: string,
  values: readonly unknown[] = [],
): Promise<Row | null> {
  const result = await client.query<Row>(text, [...values]);
  return result.rows[0] ?? null;
}

export async function execute(client: Pick<DatabaseClient, 'query'>, text: string): Promise<QueryResult> {
  return client.query(text);
}
