export async function readJsonBody(request: AsyncIterable<Buffer | string>): Promise<unknown> {
  let body = '';

  for await (const chunk of request) {
    body += chunk.toString();
  }

  if (body.trim().length === 0) {
    return {};
  }

  return JSON.parse(body) as unknown;
}

export function applyCors(
  response: {
    setHeader(name: string, value: string): void;
  },
  input: {
    origin?: string;
    allowedOrigin?: string;
  },
): void {
  const allowOrigin =
    input.origin && input.allowedOrigin && input.origin === input.allowedOrigin
      ? input.origin
      : input.allowedOrigin;

  if (!allowOrigin) {
    return;
  }

  response.setHeader('access-control-allow-origin', allowOrigin);
  response.setHeader('vary', 'Origin');
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  response.setHeader('access-control-allow-headers', 'authorization,content-type');
 }

export function sendJson(
  response: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: string): void;
  },
  status: number,
  body: unknown,
): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}
