import { getDb } from './db';
import { ensureFuelLedgerTables } from './fuel-ledger';

let schemaReady: Promise<void> | null = null;
export function ensureLocationHistorySchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureFuelLedgerTables();
      await getDb().query(`ALTER TABLE public.asset_scan_events
        ADD COLUMN IF NOT EXISTS location_history_deleted_at timestamptz`);
    })().catch(error => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

// Scan events may also contain fuel, maintenance or work records. Delete only
// their location-history projection, retaining the underlying activity record.
export const DELETE_LOCATION_HISTORY_SQL = `
  UPDATE public.asset_scan_events e SET location_history_deleted_at = now()
  FROM public.asset_register_items a
  WHERE e.asset_id = a.id AND a.user_id = $1 AND a.id = $2::uuid
    AND e.id = $3::uuid AND e.location_history_deleted_at IS NULL
    AND e.latitude BETWEEN -90 AND 90 AND e.longitude BETWEEN -180 AND 180
  RETURNING e.id`;

export async function deleteLocationHistoryEntry(ownerId: string, assetId: string, entryId: string) {
  await ensureLocationHistorySchema();
  const result = await getDb().query(DELETE_LOCATION_HISTORY_SQL, [ownerId, assetId, entryId]);
  return result.rows.length > 0;
}

// Clear the location projection only, including records outside the visible page.
export const DELETE_ALL_LOCATION_HISTORY_SQL = `
  UPDATE public.asset_scan_events e SET location_history_deleted_at = now()
  FROM public.asset_register_items a
  WHERE e.asset_id = a.id AND a.user_id = $1 AND a.id = $2::uuid
    AND e.location_history_deleted_at IS NULL AND e.created_at <= $3::timestamptz
    AND e.latitude BETWEEN -90 AND 90 AND e.longitude BETWEEN -180 AND 180`;

export async function deleteAllLocationHistory(ownerId: string, assetId: string, snapshotAt: string) {
  await ensureLocationHistorySchema();
  const result = await getDb().query(DELETE_ALL_LOCATION_HISTORY_SQL, [ownerId, assetId, snapshotAt]);
  return result.rowCount || 0;
}
