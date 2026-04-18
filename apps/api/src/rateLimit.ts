import { ErrorCodes } from '@wifiman/shared';
import type { Context, MiddlewareHandler } from 'hono';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

function getClientKey(c: Context, keyPrefix: string): string {
  const forwardedFor = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = c.req.header('x-real-ip');
  return `${keyPrefix}:${forwardedFor || realIp || 'unknown'}`;
}

export function fixedWindowRateLimit(options: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const now = Date.now();
    const key = getClientKey(c, options.keyPrefix);
    const current = buckets.get(key);
    const bucket =
      current && current.resetAt > now
        ? current
        : {
            count: 0,
            resetAt: now + options.windowMs,
          };

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > options.max) {
      return c.json(
        {
          error: {
            code: ErrorCodes.RATE_LIMITED,
            message: 'リクエスト回数が多すぎます。しばらく待ってから再試行してください',
          },
        },
        429,
      );
    }

    await next();
  };
}
