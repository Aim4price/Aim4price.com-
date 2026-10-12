import { getDb } from './db';
import { DEFAULT_FUEL_WORK_CHOICES, validateFuelWorkChoices, type FuelWorkChoice } from './fuel-work-choice-options';
let schema: Promise<void> | undefined;
async function ensureSchema() {
  if (!schema) schema = getDb().query(`CREATE TABLE IF NOT EXISTS public.fuel_work_choices (
    owner_user_id text PRIMARY KEY, choices jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`).then(() => undefined).catch(error => { schema = undefined; throw error; });
  await schema;
}
export async function getFuelWorkChoices(ownerUserId: string): Promise<{ choices: FuelWorkChoice[]; revision: number }> {
  await ensureSchema();
  const result = await getDb().query('SELECT choices, revision FROM public.fuel_work_choices WHERE owner_user_id = $1', [ownerUserId]);
  return result.rows[0] ?? { choices: DEFAULT_FUEL_WORK_CHOICES, revision: 0 };
}
export async function saveFuelWorkChoices(ownerUserId: string, input: unknown, revision: unknown) {
  const choices = validateFuelWorkChoices(input);
  if (!Number.isSafeInteger(revision) || Number(revision) < 0) throw new Error('Reload the work choices and try again.');
  await ensureSchema();
  // A stale editor must not overwrite another user's changes, including first save.
  const result = Number(revision) === 0
    ? await getDb().query(`INSERT INTO public.fuel_work_choices (owner_user_id, choices) VALUES ($1, $2::jsonb)
        ON CONFLICT (owner_user_id) DO NOTHING RETURNING choices, revision`, [ownerUserId, JSON.stringify(choices)])
    : await getDb().query(`UPDATE public.fuel_work_choices SET choices = $2::jsonb, revision = revision + 1, updated_at = now()
        WHERE owner_user_id = $1 AND revision = $3 RETURNING choices, revision`, [ownerUserId, JSON.stringify(choices), revision]);
  return result.rows[0] ?? null;
}
