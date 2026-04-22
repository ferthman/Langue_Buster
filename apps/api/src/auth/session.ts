import type { SessionPayload } from '@langue-buster/shared';
import { sessionPayloadSchema } from '@langue-buster/shared';
import { randomBytes, randomUUID } from 'node:crypto';

type IssueSessionOptions = {
  now?: () => Date;
  ttlSeconds?: number;
};

const defaultSessionTtlSeconds = 60 * 60 * 24 * 7;

export function issueSession(
  userId: string,
  options: IssueSessionOptions = {},
): SessionPayload {
  const now = options.now ?? (() => new Date());
  const ttlSeconds = options.ttlSeconds ?? defaultSessionTtlSeconds;
  const issuedAt = now();
  const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);

  return sessionPayloadSchema.parse({
    id: `sess_${randomUUID()}`,
    token: randomBytes(32).toString('base64url'),
    userId,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
}

