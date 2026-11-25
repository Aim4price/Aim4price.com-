import { getDb } from './db';
import type { HoverAudience } from './card-screenshot-policy';

let ready: Promise<void> | undefined;
export function ensureCardScreenshots() {
  return ready ??= getDb().query(`CREATE TABLE IF NOT EXISTS workspace_card_screenshots (
    audience text NOT NULL, card text NOT NULL, id uuid NOT NULL UNIQUE,
    mime text NOT NULL, data bytea NOT NULL, PRIMARY KEY (audience, card)
  )`).then(() => {}).catch((error: unknown) => { ready = undefined; throw error; });
}

export async function cardScreenshots(audience: HoverAudience): Promise<Record<string,string>> {
  await ensureCardScreenshots();
  const result = await getDb().query('SELECT card, id FROM workspace_card_screenshots WHERE audience=$1', [audience]);
  return Object.fromEntries(result.rows.map(row => [row.card, row.id]));
}
