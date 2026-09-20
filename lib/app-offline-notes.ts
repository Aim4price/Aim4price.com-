import { getDb } from './db';
import type { OfflineAccess } from './app-offline-access';
export async function ensureOfflineNotes() {
  await getDb().query(`create table if not exists public.app_offline_notes (
    identity text not null, event_id text not null, user_id text not null,
    app text not null, title text not null, note text not null,
    captured_at timestamptz not null, created_at timestamptz not null default now(),
    primary key (identity, event_id)
  )`);
}
export async function listOfflineNotes(access: OfflineAccess) {
  await ensureOfflineNotes();
  return (await getDb().query(`select event_id as id, title, note, captured_at as "capturedAt" from public.app_offline_notes where identity = $1 and user_id = $2 order by captured_at desc limit 200`, [access.identity, access.userId])).rows;
}
export async function saveOfflineNote(access: OfflineAccess, input: Record<string, unknown>) {
  const title = String(input.title || '').trim();
  const note = String(input.note || '').trim();
  const id = String(input.clientEventId || '');
  const captured = String(input.clientCapturedAt || '');
  if (!/^[a-zA-Z0-9:_-]{12,160}$/.test(id) || !title || title.length > 200 || !note || note.length > 5000 || !Number.isFinite(Date.parse(captured))) throw Error('Enter a title and note with a valid capture date.');
  await ensureOfflineNotes();
  await getDb().query(`insert into public.app_offline_notes (identity, event_id, user_id, app, title, note, captured_at) values ($1,$2,$3,$4,$5,$6,$7) on conflict (identity,event_id) do nothing`, [access.identity, id, access.userId, access.app, title, note, captured]);
}
