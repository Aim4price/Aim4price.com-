import { getDb } from './db';
import type { HoverAudience } from './hover-video-policy';

let ready: Promise<void> | undefined;
export function ensureHoverVideos() {
  return ready ??= getDb().query(`CREATE TABLE IF NOT EXISTS workspace_hover_videos (
    audience text NOT NULL, card text NOT NULL, id uuid NOT NULL UNIQUE,
    mime text NOT NULL, data bytea NOT NULL, PRIMARY KEY (audience, card)
  )`).then(() => {}).catch((error: unknown) => { ready = undefined; throw error; });
}

export async function hoverRecordings(audience: HoverAudience): Promise<Record<string,string>> {
  await ensureHoverVideos();
  const result = await getDb().query('SELECT card, id FROM workspace_hover_videos WHERE audience=$1', [audience]);
  return Object.fromEntries(result.rows.map(row => [row.card, row.id]));
}
