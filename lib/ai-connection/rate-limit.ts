import { ConnectionError } from './security';
// Bounded per-process burst protection. Use an edge/gateway limit as well when scaling replicas.
const windows = new Map<string, { count: number; expires: number }>();
export function checkReadRate(userId: string, now = Date.now()) {
  for (const [key, value] of windows)
    if (value.expires <= now) windows.delete(key);
  let entry = windows.get(userId);
  if (!entry) {
    if (windows.size >= 1000)
      throw new ConnectionError(
        429,
        'rate_limited',
        'Please try again shortly.',
      );
    entry = { count: 0, expires: now + 60_000 };
    windows.set(userId, entry);
  }
  if (++entry.count > 120)
    throw new ConnectionError(
      429,
      'rate_limited',
      'Too many requests. Please wait a minute.',
    );
}
