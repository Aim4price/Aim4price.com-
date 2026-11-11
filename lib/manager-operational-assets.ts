import { getDb } from './db';
import { operationalAssetSql } from './operational-asset';
export async function ensureManagerAssetPublicCodes(
  ownerUserId: string,
): Promise<void> {
  const normalizedOwnerUserId = String(ownerUserId || '').trim();
  if (!normalizedOwnerUserId) return;

  const db = getDb();
  await db.query(
    `
      update public.asset_register_items a
      set
        public_asset_code = 'FM-' || upper(substr(md5(a.id::text), 1, 12)),
        plate_label = coalesce(
          nullif(trim(coalesce(a.plate_label, '')), ''),
          'FM-' || upper(substr(md5(a.id::text), 1, 6))
        ),
        qr_status = coalesce(nullif(trim(coalesce(a.qr_status, '')), ''), 'active')
      where (
          nullif(trim(coalesce(to_jsonb(a)->>'user_id', '')), '') = $1
          or exists (
            select 1
            from public.asset_registers ar
            where ar.id::text = nullif(trim(coalesce(to_jsonb(a)->>'register_id', '')), '')
              and nullif(trim(coalesce(to_jsonb(ar)->>'user_id', '')), '') = $1
          )
          or exists (
            select 1
            from public.valuation_runs vr
            where vr.id::text = nullif(trim(coalesce(to_jsonb(a)->>'valuation_run_id', '')), '')
              and nullif(trim(coalesce(to_jsonb(vr)->>'user_id', '')), '') = $1
          )
        )
        and ${operationalAssetSql('a')}
        and nullif(trim(coalesce(a.public_asset_code, '')), '') is null
    `,
    [normalizedOwnerUserId],
  );
}


export async function listManagerFuelStorages(ownerUserId: string) {
  const db = getDb();
  if (!(await db.query("SELECT to_regclass('public.fuel_storage_units') AS name")).rows[0]?.name) return [];
  await db.query(`UPDATE fuel_storage_units SET public_fuel_storage_code='FMFUEL-' || upper(substr(md5(id::text),1,12))
    WHERE user_id=$1 AND status='active' AND nullif(trim(public_fuel_storage_code),'') IS NULL`, [ownerUserId]);
  const rows = (await db.query(`SELECT id,user_id,name,fuel_type,public_fuel_storage_code,capacity_litres,current_litres,location_label,updated_at
    FROM fuel_storage_units WHERE user_id=$1 AND status='active' ORDER BY name,id`,[ownerUserId])).rows;
  return rows.map(row => ({ id: String(row.id), ownerUserId: row.user_id, name: row.name, fuelType: row.fuel_type,
    publicFuelStorageCode: row.public_fuel_storage_code, capacityLitres: row.capacity_litres === null ? null : Number(row.capacity_litres),
    currentLitres: Number(row.current_litres), stockPercent: Number(row.capacity_litres)>0 ? Number(row.current_litres)/Number(row.capacity_litres)*100 : null,
    locationLabel: row.location_label || '', updatedAtIso: row.updated_at ? new Date(row.updated_at).toISOString() : null }));
}
