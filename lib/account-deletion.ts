import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getDb } from './db';

type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
};

const USER_ID_TABLES = [
  // Document metadata must be removed before its underlying upload catalog.
  // Asset links cascade from account_documents.
  'account_documents',
  'asset_register_uploads',
  'fuel_late_entry_evidence',
  'fuel_slips',
  'fuel_storage_events',
  'fuel_storage_units',
  // Budget alerts cascade from budgets; budgets must precede asset deletion
  // so all-assets rows without an asset foreign key are also removed.
  'asset_cost_budgets',
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
  // Delete Bucket metadata last. Migration 81 queues the exact private object
  // for a 30-day recovery delay before any physical Bucket purge.
  'asset_register_bucket_uploads',
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

const ASSISTED_CAPTURE_TABLES = [
  'document_capture_requests',
  'document_capture_files',
  'document_capture_events',
  'capture_quarantine_object_purge_queue',
  'capture_asset_upload_cleanup_queue',
  'asset_invoice_drop_codes',
  'asset_invoice_documents',
  'asset_invoices',
  'fuel_slips',
] as const;

async function getExistingTableSet(
  queryable: Queryable,
  tableNames: readonly string[],
): Promise<Set<string>> {
  const result = await queryable.query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = any (current_schemas(false))
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
    `delete from ${quoteIdentifier(tableName)} where ${quoteIdentifier(columnName)} = $1`,
    [userId],
  );
}

async function deleteUserWorkspaceDataInTransaction(
  queryable: Queryable,
  userId: string,
): Promise<void> {
  // Bucket-only uploads hold the matching session advisory lock while their
  // pending row is written and verified. Account deletion waits here so a
  // concurrent upload cannot create an object after its only catalog row has
  // already been removed.
  await queryable.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [userId]);

  // Better Auth deletes its user row after the workspace-deletion hook
  // returns. Persist a tombstone while this lock is held so an upload request
  // that was authenticated earlier cannot wait, resume, and create a new
  // Bucket object in that gap. Keep pre-migration deployments compatible.
  const bucketDeletionGuard = await queryable.query<{ exists: boolean }>(
    `select to_regclass('public.asset_register_bucket_deleted_accounts') is not null as exists`,
  );
  if (bucketDeletionGuard.rows[0]?.exists) {
    await queryable.query(
      `
        insert into public.asset_register_bucket_deleted_accounts (user_id)
        values ($1)
        on conflict (user_id) do nothing
      `,
      [userId],
    );
  }

  const tableSet = await getExistingTableSet(queryable, [
    ...USER_ID_TABLES,
    ...PARTNER_ACCESS_TABLES,
    ...USER_COMMUNICATION_TABLES,
    ...ASSISTED_CAPTURE_TABLES,
  ]);

  // Capture requests point both to and from canonical ledger records. Unlink
  // their retry-safety provenance, then remove the owner's private workflow
  // history before asset/invoice cascades run later in this transaction.
  if (tableSet.has('document_capture_requests')) {
    if (tableSet.has('asset_invoice_documents')) {
      await queryable.query(
        `update asset_invoice_documents document
            set capture_request_id = null
          where document.capture_request_id in (
            select id from document_capture_requests where owner_user_id = $1
          )`,
        [userId],
      );
    }
    if (tableSet.has('asset_invoices')) {
      await queryable.query(
        `update asset_invoices invoice
            set capture_request_id = null
          where invoice.capture_request_id in (
            select id from document_capture_requests where owner_user_id = $1
          )`,
        [userId],
      );
    }
    if (tableSet.has('fuel_slips')) {
      await queryable.query(
        `update fuel_slips slip
            set capture_request_id = null
          where slip.capture_request_id in (
            select id from document_capture_requests where owner_user_id = $1
          )`,
        [userId],
      );
    }
    if (tableSet.has('document_capture_events')) {
      await queryable.query(
        `delete from document_capture_events event
          where event.capture_request_id in (
            select id from document_capture_requests where owner_user_id = $1
          )`,
        [userId],
      );
    }
    if (tableSet.has('document_capture_files')) {
      if (tableSet.has('capture_quarantine_object_purge_queue')) {
        // Preserve the exact private object key before its only owner-scoped
        // capture metadata is removed. The queue deliberately has no account
        // foreign key, so this cleanup intent survives account deletion.
        await queryable.query(
          `insert into capture_quarantine_object_purge_queue as queued (
             storage_key,
             queued_at,
             purge_after,
             reason
           )
           select file.storage_key, now(), now(), 'account_deletion'
           from document_capture_files file
           join document_capture_requests request
             on request.id = file.capture_request_id
           where request.owner_user_id = $1
             and file.storage_key ~ '^v1/capture-quarantine/[0-9a-f]{2}/20[0-9]{2}/(0[1-9]|1[0-2])/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           on conflict (storage_key) do update
           set queued_at = least(queued.queued_at, excluded.queued_at),
               purge_after = least(queued.purge_after, excluded.purge_after),
               reason = excluded.reason,
               attempt_count = 0,
               last_error = null,
               cancelled_at = null,
               purged_at = null`,
          [userId],
        );
      }
      await queryable.query(
        `delete from document_capture_files file
          where file.capture_request_id in (
            select id from document_capture_requests where owner_user_id = $1
          )`,
        [userId],
      );
    }
    await queryable.query('delete from document_capture_requests where owner_user_id = $1', [userId]);

    // If the deleted account contributed to another owner's request, retain
    // the financial workflow but remove that account's internal identifiers.
    await queryable.query(
      `update document_capture_requests
          set sender_name = case when submitted_by_user_id = $1 then 'Deleted contributor' else sender_name end,
              sender_business_name = case when submitted_by_user_id = $1 then null else sender_business_name end,
              sender_email = case when submitted_by_user_id = $1 then null else sender_email end,
              sender_phone = case when submitted_by_user_id = $1 then null else sender_phone end,
              submitted_by_user_id = case when submitted_by_user_id = $1 then null else submitted_by_user_id end,
              assigned_admin_display_name = case when assigned_admin_user_id = $1 then null else assigned_admin_display_name end,
              claimed_at = case when assigned_admin_user_id = $1 then null else claimed_at end,
              assigned_admin_user_id = case when assigned_admin_user_id = $1 then null else assigned_admin_user_id end
        where submitted_by_user_id = $1 or assigned_admin_user_id = $1`,
      [userId],
    );
  }

  if (tableSet.has('document_capture_events')) {
    await queryable.query(
      `update document_capture_events
          set actor_user_id = null,
              actor_display_name = 'Deleted account'
        where actor_user_id = $1`,
      [userId],
    );
  }
  if (tableSet.has('document_capture_files')) {
    await queryable.query(
      `update document_capture_files
          set created_by_user_id = case when created_by_user_id = $1 then null else created_by_user_id end,
              security_checked_by_admin_user_id = case
                when security_checked_by_admin_user_id = $1 then 'deleted-account'
                else security_checked_by_admin_user_id
              end
        where created_by_user_id = $1 or security_checked_by_admin_user_id = $1`,
      [userId],
    );
  }
  if (tableSet.has('asset_invoice_drop_codes')) {
    await queryable.query('delete from asset_invoice_drop_codes where owner_user_id = $1', [userId]);
    await queryable.query(
      `update asset_invoice_drop_codes
          set created_by_user_id = case when created_by_user_id = $1 then null else created_by_user_id end,
              created_by_display_name = case when created_by_user_id = $1 then 'Deleted account' else created_by_display_name end,
              revoked_by_user_id = case when revoked_by_user_id = $1 then null else revoked_by_user_id end
        where created_by_user_id = $1 or revoked_by_user_id = $1`,
      [userId],
    );
  }

  if (tableSet.has('asset_accountant_documents')) {
    await queryable.query('delete from asset_accountant_documents where owner_user_id = $1 or accountant_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_accounting_values')) {
    await queryable.query('delete from asset_accounting_values where owner_user_id = $1 or updated_by_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_lifecycle_events')) {
    await queryable.query('delete from asset_lifecycle_events where owner_user_id = $1 or actor_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_leads') && tableSet.has('insurance_snapshot_revisions')) {
    await queryable.query(
      `delete from insurance_snapshot_revisions
       where source_share_id in (
         select id from asset_leads where owner_user_id = $1 or partner_user_id = $1
       )`,
      [userId],
    );
  }

  if (tableSet.has('asset_leads') && tableSet.has('insurance_workspaces')) {
    await queryable.query(
      `delete from insurance_workspaces
       where source_lead_id in (
         select id from asset_leads where owner_user_id = $1 or partner_user_id = $1
       )`,
      [userId],
    );
  }

  if (tableSet.has('asset_leads')) {
    await queryable.query('delete from asset_leads where owner_user_id = $1 or partner_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_partner_notes')) {
    await queryable.query('delete from asset_partner_notes where owner_user_id = $1 or partner_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_register_access_grants')) {
    await queryable.query('delete from asset_register_access_grants where owner_user_id = $1 or partner_user_id = $1', [userId]);
  }

  if (tableSet.has('access_audit_events')) {
    await queryable.query('delete from access_audit_events where owner_user_id = $1 or actor_user_id = $1', [userId]);
  }

  if (tableSet.has('account_contact_requests')) {
    await queryable.query('delete from account_contact_requests where owner_user_id = $1 or requester_user_id = $1', [userId]);
  }

  if (tableSet.has('account_user_messages')) {
    await queryable.query('delete from account_user_messages where owner_user_id = $1 or sender_user_id = $1', [userId]);
  }

  if (tableSet.has('dealer_app_staff')) {
    await queryable.query('delete from dealer_app_staff where dealer_user_id = $1', [userId]);
  }

  if (tableSet.has('owner_app_overview_dismissals')) {
    await queryable.query('delete from owner_app_overview_dismissals where parent_owner_user_id = $1', [userId]);
  }

  if (tableSet.has('owner_app_users')) {
    await queryable.query('delete from owner_app_users where parent_owner_user_id = $1', [userId]);
  }

  if (tableSet.has('asset_discovery_enquiries')) {
    await queryable.query(
      'delete from asset_discovery_enquiries where requester_user_id = $1 or dealer_user_id = $1 or owner_user_id = $1',
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

  // The upload catalogs have now been deleted and their existing migration
  // 80/81 triggers hold the durable object purge intents. Remove the temporary
  // attachment guard so it does not retain the deleted account identifier.
  if (tableSet.has('capture_asset_upload_cleanup_queue')) {
    await queryable.query(
      'delete from capture_asset_upload_cleanup_queue where owner_user_id = $1',
      [userId],
    );
  }
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
