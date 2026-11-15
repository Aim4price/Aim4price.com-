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

// The asset row serializes deletion with location saves, which update that same row.
// Only roll back a deleted latest observation that still represents the saved pin.
export const RESTORE_PREVIOUS_LOCATION_SQL = `
  WITH previous AS (
    SELECT latitude, longitude, location_text, coalesce(client_captured_at, created_at) AS captured_at
    FROM public.asset_scan_events
    WHERE asset_id = $2::uuid AND location_history_deleted_at IS NULL
      AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
    ORDER BY created_at DESC, id DESC LIMIT 1
  )
  UPDATE public.asset_register_items
  SET last_known_lat = (SELECT latitude FROM previous),
      last_known_lng = (SELECT longitude FROM previous),
      last_known_location_text = (SELECT location_text FROM previous),
      last_scanned_at = (SELECT captured_at FROM previous), updated_at = now()
  WHERE user_id = $1 AND id = $2::uuid
    AND last_known_lat = $3::double precision AND last_known_lng = $4::double precision`;

export async function deleteLocationHistoryEntry(ownerId: string, assetId: string, entryId: string) {
  await ensureLocationHistorySchema();
  const client = await getDb().connect();
  try {
    await client.query('BEGIN');
    const asset = await client.query('SELECT id FROM public.asset_register_items WHERE user_id = $1 AND id = $2::uuid FOR UPDATE', [ownerId, assetId]);
    if (!asset.rows.length) { await client.query('ROLLBACK'); return false; }
    const latest = await client.query(`SELECT id, latitude, longitude FROM public.asset_scan_events
      WHERE asset_id = $1::uuid AND location_history_deleted_at IS NULL
        AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
      ORDER BY created_at DESC, id DESC LIMIT 1`, [assetId]);
    const deleted = await client.query(DELETE_LOCATION_HISTORY_SQL, [ownerId, assetId, entryId]);
    if (deleted.rows.length && latest.rows[0]?.id === entryId) {
      await client.query(RESTORE_PREVIOUS_LOCATION_SQL, [ownerId, assetId, latest.rows[0].latitude, latest.rows[0].longitude]);
    }
    await client.query('COMMIT');
    return deleted.rows.length > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
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
