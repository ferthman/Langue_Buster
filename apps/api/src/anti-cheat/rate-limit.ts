import { createHash } from 'node:crypto';

import type { AntiCheatAnomalyType } from '@langue-buster/shared';

export type RateLimitRule = {
  routeId: string;
  limit: number;
  windowMs: number;
  anomalyType?: AntiCheatAnomalyType;
};

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

type Bucket = {
  count: number;
  resetAtMs: number;
};

export type RateLimiter = ReturnType<typeof createFixedWindowRateLimiter>;

export function createFixedWindowRateLimiter(options: {
  now?: () => Date;
}) {
  const now = options.now ?? (() => new Date());
  const buckets = new Map<string, Bucket>();

  return {
    check(input: {
      rule: RateLimitRule;
      identity: string;
    }): RateLimitDecision {
      const nowMs = now().getTime();
      const key = `${input.rule.routeId}:${hashIdentity(input.identity)}`;
      const current = buckets.get(key);

      if (!current || current.resetAtMs <= nowMs) {
        buckets.set(key, {
          count: 1,
          resetAtMs: nowMs + input.rule.windowMs,
        });
        return {
          allowed: true,
          remaining: input.rule.limit - 1,
        };
      }

      if (current.count >= input.rule.limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((current.resetAtMs - nowMs) / 1000)),
        };
      }

      current.count += 1;
      return {
        allowed: true,
        remaining: input.rule.limit - current.count,
      };
    },
  };
}

export function buildRateLimitIdentity(input: {
  authorizationHeader?: string;
  ipAddress?: string;
  routeScopedId?: string;
}): string {
  const authPart = input.authorizationHeader?.trim()
    ? `auth:${input.authorizationHeader.trim()}`
    : `ip:${input.ipAddress ?? 'unknown'}`;
  return input.routeScopedId ? `${authPart}:${input.routeScopedId}` : authPart;
}

function hashIdentity(identity: string): string {
  return createHash('sha256').update(identity).digest('hex');
}
