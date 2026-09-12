import { getDb } from "./db";
import { maintenanceCatalogueSeed } from "./maintenance-catalogue-seed";
import {
  validateMaintenanceCatalogue,
  type MaintenanceCatalogue,
} from "./maintenance-catalogue";

let ready: Promise<void> | undefined;
export function ensureMaintenanceCatalogue(): Promise<void> {
  if (!ready)
    ready = getDb()
      .query(
        `create table if not exists public.maintenance_catalogue (
    id boolean primary key default true check (id), version integer not null,
    catalogue jsonb not null, updated_by text, updated_at timestamptz not null default now()
  )`,
      )
      .then(() => undefined)
      .catch((e) => {
        ready = undefined;
        throw e;
      });
  return ready;
}
export async function getMaintenanceCatalogue(): Promise<MaintenanceCatalogue> {
  await ensureMaintenanceCatalogue();
  const { rows } = await getDb().query<{ catalogue: MaintenanceCatalogue }>(
    "select catalogue from public.maintenance_catalogue where id = true",
  );
  return rows[0]?.catalogue || maintenanceCatalogueSeed;
}
export async function saveMaintenanceCatalogue(
  input: unknown,
  expectedVersion: number,
  userId: string,
): Promise<MaintenanceCatalogue> {
  const catalogue = validateMaintenanceCatalogue(input);
  await ensureMaintenanceCatalogue();
  const client = await getDb().connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(481172039)");
    const { rows } = await client.query<{ version: number }>(
      "select version from public.maintenance_catalogue where id = true for update",
    );
    const version = rows[0]?.version || maintenanceCatalogueSeed.version;
    if (expectedVersion !== version)
      throw new Error("Catalogue changed. Reload before saving.");
    const next = { ...catalogue, version: version + 1 };
    await client.query(
      `insert into public.maintenance_catalogue (id,version,catalogue,updated_by) values (true,$1,$2::jsonb,$3)
      on conflict (id) do update set version=excluded.version,catalogue=excluded.catalogue,updated_by=excluded.updated_by,updated_at=now()`,
      [next.version, JSON.stringify(next), userId],
    );
    await client.query("commit");
    return next;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
