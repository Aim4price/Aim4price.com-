import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getDb } from './db';

type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
};

const ASSET_REGISTER_UPLOADS_TABLE = 'asset_register_uploads';
const ASSET_SCAN_EVENTS_TABLE = 'asset_scan_events';
const UPLOAD_RECOVERY_WINDOW_SQL = "interval '30 days'";

// Uploads are deliberately excluded. Their IDs are collected before workspace
// deletion and scheduled last, after every known business reference has been
// removed. If migration 81 is unavailable—or any collected upload remains
// reference-held and accessible—the entire account-deletion transaction rolls back.
const USER_ID_TABLES = [
  'ad_brand_kits',
  'fuel_ledger_audit_events',
  'fuel_slips',
  'asset_invoices',
  'asset_invoice_documents',
  'fuel_late_entry_evidence',
  'fuel_storage_events',
  'fuel_storage_units',
  'asset_register_items',
  'valuation_runs',
  'marketplace_listings',
  'middleman_showrooms',
  'asset_registers',
  'account_profiles',
  'dealer_app_staff',
  'owner_app_users',
  'owner_app_overview_dismissals',
  'asset_discovery_enquiries',
] as const;

const PARTNER_ACCESS_TABLES = [
  'asset_accountant_documents',
  'asset_accounting_values',
  'asset_lifecycle_events',
  'asset_leads',
  'asset_partner_notes',
  'asset_register_access_grants',
  'access_audit_events',
  'insurance_snapshot_revisions',
  'insurance_workspaces',
] as const;

const USER_COMMUNICATION_TABLES = [
  'account_contact_requests',
  'account_user_messages',
] as const;

async function getExistingTableSet(
  queryable: Queryable,
  tableNames: readonly string[],
): Promise<Set<string>> {
  const result = await queryable.query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
    `,
    [tableNames],
  );

  return new Set(result.rows.map((row) => row.table_name));
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function deleteByColumn(
  queryable: Queryable,
  tableSet: Set<string>,
  tableName: string,
  columnName: string,
  userId: string,
): Promise<void> {
  if (!tableSet.has(tableName)) {
    return;
  }

  await queryable.query(
    `delete from public.${quoteIdentifier(tableName)} where ${quoteIdentifier(columnName)} = $1`,
    [userId],
  );
}

async function collectOwnedUploadIds(
  queryable: Queryable,
  tableSet: Set<string>,
  userId: string,
): Promise<string[]> {
  if (!tableSet.has(ASSET_REGISTER_UPLOADS_TABLE)) {
    return [];
  }

  const result = await queryable.query<{ id: string }>(
    `
      select id::text as id
      from public.asset_register_uploads
      where user_id = $1
      order by id
    `,
    [userId],
  );

  return result.rows.map((row) => String(row.id ?? '').trim()).filter(Boolean);
}

async function scheduleOwnedUploadsLast(
  queryable: Queryable,
  tableSet: Set<string>,
  userId: string,
  uploadIds: string[],
): Promise<void> {
  if (!tableSet.has(ASSET_REGISTER_UPLOADS_TABLE) || !uploadIds.length) {
    return;
  }

  const functions = await queryable.query<{
    has_ready_function: boolean;
    has_live_reference_function: boolean;
  }>(`
    select
      to_regprocedure('public.asset_upload_reference_ledger_ready()') is not null
        as has_ready_function,
      to_regprocedure('public.asset_upload_has_live_reference(text)') is not null
        as has_live_reference_function
  `);
  const available = functions.rows[0];

  if (!available?.has_ready_function || !available.has_live_reference_function) {
    throw new Error(
      'Upload-reference guards are unavailable; account deletion was stopped without removing workspace data.',
    );
  }

  const readiness = await queryable.query<{ ready: boolean }>(
    'select public.asset_upload_reference_ledger_ready() as ready',
  );

  if (readiness.rows[0]?.ready !== true) {
    throw new Error(
      'Upload-reference guards are not ready; account deletion was stopped without removing workspace data.',
    );
  }

  await queryable.query(
    `
      update public.asset_register_uploads upload
      set
        deleted_at = coalesce(upload.deleted_at, now()),
        purge_after = coalesce(upload.purge_after, now() + ${UPLOAD_RECOVERY_WINDOW_SQL})
      where upload.user_id = $1
        and upload.id = any($2::text[])
        and not public.asset_upload_has_live_reference(upload.id)
    `,
    [userId, uploadIds],
  );

  // Pending and migration holds are safety barriers, not proof that a file is
  // still intentionally reachable after its account is gone. Refuse to commit
  // the workspace deletion while any upload collected at the start remains
  // accessible. Operators can reconcile/release those holds and retry.
  const unscheduled = await queryable.query<{ id: string }>(
    `
      select upload.id::text as id
      from public.asset_register_uploads upload
      where upload.user_id = $1
        and upload.id = any($2::text[])
        and upload.deleted_at is null
      order by upload.id
      limit 1
    `,
    [userId, uploadIds],
  );

  if (unscheduled.rowCount) {
    throw new Error(
      'One or more uploads are still reference-held; account deletion was rolled back for reconciliation.',
    );
  }
}

async function deleteUserWorkspaceDataInTransaction(
  queryable: Queryable,
  userId: string,
): Promise<void> {
  await queryable.query("set local lock_timeout = '5s'");
  await queryable.query("set local statement_timeout = '5min'");

  const tableSet = await getExistingTableSet(queryable, [
    ASSET_REGISTER_UPLOADS_TABLE,
    ASSET_SCAN_EVENTS_TABLE,
    ...USER_ID_TABLES,
    ...PARTNER_ACCESS_TABLES,
    ...USER_COMMUNICATION_TABLES,
  ]);
  // Do not lock upload rows while deleting source rows. Source-table triggers
  // may themselves update uploads when references change, so holding both sets
  // of locks in the opposite order would create a deadlock risk. A concurrent
  // upload is retained by its pending reference and can be reconciled later.
  const ownedUploadIds = await collectOwnedUploadIds(queryable, tableSet, userId);

  if (tableSet.has(ASSET_SCAN_EVENTS_TABLE) && tableSet.has('asset_register_items')) {
    await queryable.query(
      `delete from public.asset_scan_events
       where asset_id in (
         select id from public.asset_register_items where user_id = $1
       )`,
      [userId],
    );
  }

  if (tableSet.has('asset_accountant_documents')) {
    await queryable.query('delete from public.asset_accountant_documents where owner_user_id = $1 or accountant_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_accounting_values')) {
    await queryable.query('delete from public.asset_accounting_values where owner_user_id = $1 or updated_by_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_lifecycle_events')) {
    await queryable.query('delete from public.asset_lifecycle_events where owner_user_id = $1 or actor_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_leads') && tableSet.has('insurance_snapshot_revisions')) {
    await queryable.query(
      `delete from public.insurance_snapshot_revisions
       where source_share_id in (
         select id from public.asset_leads where owner_user_id = $1 or partner_user_id = $1
       )`,
      [userId],
    );
  }

  if (tableSet.has('asset_leads') && tableSet.has('insurance_workspaces')) {
    await queryable.query(
      `delete from public.insurance_workspaces
       where source_lead_id in (
         select id from public.asset_leads where owner_user_id = $1 or partner_user_id = $1
       )`,
      [userId],
    );
  }

  if (tableSet.has('asset_leads')) {
    await queryable.query('delete from public.asset_leads where owner_user_id = $1 or partner_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_partner_notes')) {
    await queryable.query('delete from public.asset_partner_notes where owner_user_id = $1 or partner_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_register_access_grants')) {
    await queryable.query('delete from public.asset_register_access_grants where owner_user_id = $1 or partner_user_id = $1', [userId]);
  }

  if (tableSet.has('access_audit_events')) {
    await queryable.query('delete from public.access_audit_events where owner_user_id = $1 or actor_user_id = $1', [userId]);
  }

  if (tableSet.has('account_contact_requests')) {
    await queryable.query('delete from public.account_contact_requests where owner_user_id = $1 or requester_user_id = $1', [userId]);
  }

  if (tableSet.has('account_user_messages')) {
    await queryable.query('delete from public.account_user_messages where owner_user_id = $1 or sender_user_id = $1', [userId]);
  }

  if (tableSet.has('dealer_app_staff')) {
    await queryable.query('delete from public.dealer_app_staff where dealer_user_id = $1', [userId]);
  }

  if (tableSet.has('owner_app_overview_dismissals')) {
    await queryable.query('delete from public.owner_app_overview_dismissals where parent_owner_user_id = $1', [userId]);
  }

  if (tableSet.has('owner_app_users')) {
    await queryable.query('delete from public.owner_app_users where parent_owner_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_discovery_enquiries')) {
    await queryable.query(
      'delete from public.asset_discovery_enquiries where requester_user_id = $1 or dealer_user_id = $1 or owner_user_id = $1',
      [userId],
    );
  }

  for (const tableName of USER_ID_TABLES) {
    if (
      tableName === 'dealer_app_staff'
      || tableName === 'owner_app_users'
      || tableName === 'owner_app_overview_dismissals'
      || tableName === 'asset_discovery_enquiries'
    ) continue;
    await deleteByColumn(queryable, tableSet, tableName, 'user_id', userId);
  }

  await scheduleOwnedUploadsLast(queryable, tableSet, userId, ownedUploadIds);
}

export async function deleteUserWorkspaceData(userId: string): Promise<void> {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await deleteUserWorkspaceDataInTransaction(client, userId);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteUserWorkspaceDataWithClient(
  client: PoolClient,
  userId: string,
): Promise<void> {
  await deleteUserWorkspaceDataInTransaction(client, userId);
}
