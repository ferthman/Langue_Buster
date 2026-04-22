import { newDb } from 'pg-mem';
import { Readable } from 'node:stream';

import type { ApiResponse } from './server.js';

export function createTestPool() {
  const database = newDb();
  const adapter = database.adapters.createPg();
  const pool = new adapter.Pool();

  return {
    database,
    pool,
    async close() {
      await pool.end();
    },
    createSiblingPool() {
      return new adapter.Pool();
    },
  };
}

export async function dispatchJson(
  handler: (request: Readable & {
    method: string;
    url: string;
    headers: Record<string, string | undefined>;
  }, response: ApiResponse) => Promise<void>,
  input: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  },
) {
  const responseState = {
    status: 200,
    headers: new Map<string, string>(),
    body: '',
  };

  const response: ApiResponse = {
    statusCode: 200,
    setHeader(name, value) {
      responseState.headers.set(name, value);
    },
    end(body) {
      responseState.status = response.statusCode;
      responseState.body = body ?? '';
    },
  };

  const requestBody = input.body === undefined ? '' : JSON.stringify(input.body);
  const request = Readable.from([requestBody]) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string | undefined>;
  };
  request.method = input.method;
  request.url = input.url;
  request.headers = input.headers ?? {};

  await handler(request, response);

  return {
    status: responseState.status,
    headers: responseState.headers,
    body: responseState.body.length > 0 ? JSON.parse(responseState.body) as unknown : null,
  };
}
