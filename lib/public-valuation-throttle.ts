import { createHash } from 'node:crypto';

// Short, per-process burst protection, not an estimate allowance. No lifetime/day quota.
// The bounded cache stores hashed network identifiers, never raw addresses.
const buckets = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 60_000;
const MAX_KEYS = 10_000;
export function publicValuationThrottle(
  request: { headers: Headers }, kind: 'calculation' | 'report' = 'calculation', now = Date.now(),
): Response | null {
  const address = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  // Do not group clients into one global bucket when the proxy provides no address.
  if (!address) return null;
  const key = createHash('sha256').update(`${kind}:${address}`).digest('hex');
  const limit = kind === 'report' ? 20 : 90;
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.until) {
    if (buckets.size >= MAX_KEYS) {
      for (const [id, entry] of buckets) if (now >= entry.until) buckets.delete(id);
      if (buckets.size >= MAX_KEYS) buckets.delete(buckets.keys().next().value!);
    }
    bucket = { count: 0, until: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count = Math.min(limit + 1, bucket.count + 1);
  if (bucket.count <= limit) return null;
  return Response.json({ ok: false, error: 'Please wait a moment before trying again. Valuations remain free.' }, {
    status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((bucket.until - now) / 1000))), 'Cache-Control': 'no-store' },
  });
}
