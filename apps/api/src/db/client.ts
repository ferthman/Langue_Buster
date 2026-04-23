import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

export type DatabaseClient = Pick<Pool, 'query' | 'end' | 'connect'>;
export type TransactionClient = Pick<PoolClient, 'query' | 'release'>;

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

export async function withTransaction<T>(
  client: Pick<DatabaseClient, 'connect'>,
  callback: (transaction: Pick<TransactionClient, 'query'>) => Promise<T>,
): Promise<T> {
  const connection = await client.connect();

  try {
    await connection.query('BEGIN');
    const result = await callback(connection);
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}
