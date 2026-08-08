import { getDb } from './db';

const MAX_NOTIFICATION_IDS = 250;
let ensureReadStatePromise: Promise<void> | null = null;

function cleanViewerKey(value: unknown): string {
  return String(value ?? '').trim().slice(0, 240);
}

function cleanEventKeys(values: string[]): string[] {
  return Array.from(new Set(
    values
      .map((value) => String(value ?? '').trim().slice(0, 500))
      .filter(Boolean),
  )).slice(0, MAX_NOTIFICATION_IDS);
}

export async function ensureAppNotificationReadState(): Promise<void> {
  if (!ensureReadStatePromise) {
    ensureReadStatePromise = (async () => {
      const db = getDb();
      await db.query(`
        create table if not exists public.app_notification_reads (
          id uuid primary key default gen_random_uuid(),
          viewer_key text not null,
          event_key text not null,
          read_at timestamptz not null default now(),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (viewer_key, event_key)
        )
      `);
      await db.query(`
        create index if not exists app_notification_reads_viewer_idx
          on public.app_notification_reads (viewer_key, read_at desc)
      `);
    })().catch((error) => {
      ensureReadStatePromise = null;
      throw error;
    });
  }

  await ensureReadStatePromise;
}

export async function listReadNotificationEventKeys(
  viewerKeyInput: string,
  eventKeysInput: string[],
): Promise<Set<string>> {
  const viewerKey = cleanViewerKey(viewerKeyInput);
  const eventKeys = cleanEventKeys(eventKeysInput);
  if (!viewerKey || !eventKeys.length) return new Set();

  await ensureAppNotificationReadState();
  const result = await getDb().query<{ event_key: string }>(
    `
      select event_key
      from public.app_notification_reads
      where viewer_key = $1
        and event_key = any($2::text[])
    `,
    [viewerKey, eventKeys],
  );

  return new Set(result.rows.map((row) => row.event_key));
}

export async function markNotificationEventKeysRead(
  viewerKeyInput: string,
  eventKeysInput: string[],
): Promise<void> {
  const viewerKey = cleanViewerKey(viewerKeyInput);
  const eventKeys = cleanEventKeys(eventKeysInput);
  if (!viewerKey || !eventKeys.length) return;

  await ensureAppNotificationReadState();
  await getDb().query(
    `
      insert into public.app_notification_reads (
        viewer_key,
        event_key,
        read_at,
        created_at,
        updated_at
      )
      select $1, event_key, now(), now(), now()
      from unnest($2::text[]) as event_key
      on conflict (viewer_key, event_key) do update
      set read_at = excluded.read_at,
          updated_at = now()
    `,
    [viewerKey, eventKeys],
  );
}
