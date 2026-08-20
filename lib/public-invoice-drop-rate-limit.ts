import type { QueryResultRow } from 'pg';
import { getDb } from './db';

export type PublicInvoiceRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

type RateLimitRow = QueryResultRow & {
  request_count: number | string;
  reset_at: Date | string;
};

const KEY_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Atomically consumes one allowance from the shared public-upload throttle.
 * The caller should fail closed if this check cannot reach the database.
 */
export async function consumePublicInvoiceDropRateLimit(
  keyInput: string,
  options: { limit?: number; windowMs?: number } = {},
): Promise<PublicInvoiceRateLimitResult> {
  const key = String(keyInput || '').trim().toLowerCase();
  if (!KEY_PATTERN.test(key)) throw new Error('PUBLIC_INVOICE_RATE_KEY_INVALID');

  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 8)));
  const windowMs = Math.min(
    24 * 60 * 60 * 1000,
    Math.max(10_000, Math.trunc(options.windowMs ?? 15 * 60 * 1000)),
  );

  const result = await getDb().query<RateLimitRow>(
    `
      insert into public.public_invoice_drop_rate_limits (
        rate_key,
        window_started_at,
        request_count,
        updated_at
      ) values ($1, now(), 1, now())
      on conflict (rate_key) do update
      set
        window_started_at = case
          when public.public_invoice_drop_rate_limits.window_started_at
            <= now() - ($2::bigint * interval '1 millisecond')
          then now()
          else public.public_invoice_drop_rate_limits.window_started_at
        end,
        request_count = case
          when public.public_invoice_drop_rate_limits.window_started_at
            <= now() - ($2::bigint * interval '1 millisecond')
          then 1
          else least(1000000, public.public_invoice_drop_rate_limits.request_count + 1)
        end,
        updated_at = now()
      returning
        request_count,
        window_started_at + ($2::bigint * interval '1 millisecond') as reset_at
    `,
    [key, windowMs],
  );

  const row = result.rows[0];
  if (!row) throw new Error('PUBLIC_INVOICE_RATE_LIMIT_UNAVAILABLE');
  const count = Math.max(1, Number(row.request_count) || 1);
  const resetAt = new Date(row.reset_at).getTime();
  const retryAfterSeconds = count > limit
    ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
    : 0;

  // Opportunistic bounded cleanup. The HMAC prefix makes this run for roughly
  // one in every 256 distinct keys without adding another scheduler.
  if (key.startsWith('00')) {
    void getDb().query(
      `delete from public.public_invoice_drop_rate_limits
        where updated_at < now() - interval '2 days'`,
    ).catch(() => null);
  }

  return {
    allowed: count <= limit,
    retryAfterSeconds,
    remaining: Math.max(0, limit - count),
  };
}
