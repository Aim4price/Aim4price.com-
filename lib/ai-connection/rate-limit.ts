import { ConnectionError } from "./security";
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
        "rate_limited",
        "Please try again shortly.",
      );
    entry = { count: 0, expires: now + 60_000 };
    windows.set(userId, entry);
  }
  if (++entry.count > 120)
    throw new ConnectionError(
      429,
      "rate_limited",
      "Too many requests. Please wait a minute.",
    );
}

/** Shared across replicas. Only security metadata is written, outside business-read transactions. */
export async function checkSharedRate(
  pool: import("./store").ConnectionDb,
  key: string,
  limit: number,
) {
  const { digest } = await import("./security");
  const row = (
    await pool.query(
      `INSERT INTO public.ai_connection_rate_limits(bucket,window_start,requests)
    VALUES($1,date_trunc('minute',now()),1)
    ON CONFLICT(bucket) DO UPDATE SET
      requests=CASE WHEN ai_connection_rate_limits.window_start=date_trunc('minute',now()) THEN ai_connection_rate_limits.requests+1 ELSE 1 END,
      window_start=date_trunc('minute',now()) RETURNING requests`,
      [digest(key)],
    )
  ).rows[0];
  if (Number(row.requests) > limit)
    throw new ConnectionError(
      429,
      "rate_limited",
      "Too many requests. Please wait a minute.",
    );
}
