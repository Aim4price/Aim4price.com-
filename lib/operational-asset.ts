/** A retained QR/history record is not necessarily an asset available for new work. */
export function isOperationalAsset(input: { qrStatus?: unknown; lifecycleState?: unknown }): boolean {
  const active = (value: unknown) => String(value ?? '').trim().toLowerCase() || 'active';
  return active(input.qrStatus) === 'active' && active(input.lifecycleState) === 'active';
}

/** Internal SQL aliases only; JSON access also supports databases awaiting lifecycle migration. */
export function operationalAssetSql(alias: string): string {
  if (!/^[a-z][a-z0-9_]*$/i.test(alias)) throw new Error('Invalid asset SQL alias');
  return `coalesce(nullif(lower(trim(to_jsonb(${alias})->>'qr_status')), ''), 'active') = 'active'
    and coalesce(nullif(lower(trim(to_jsonb(${alias})->>'lifecycle_state')), ''), 'active') = 'active'`;
}
