import { getDb } from './db';
import { extractStandaloneIssueNoteText } from './asset-issue-notes';

/** Live permissions are checked on every read, including after sharing is revoked. */
export async function listDealerProblemNotifications(dealerUserId: string) {
  const db = getDb();
  const tables = await db.query<{ available: boolean }>(`SELECT
    to_regclass('public.dealer_maintenance_access') IS NOT NULL
    AND to_regclass('public.asset_scan_events') IS NOT NULL AS available`);
  if (!tables.rows[0]?.available) return [];
  const result = await db.query<{
    id: string; access_id: string; asset_id: string; title: string | null;
    note: string | null; operator_name: string | null; created_at: string | Date;
  }>(`
    SELECT DISTINCT ON (event.id) event.id::text, access.id::text AS access_id,
      asset.id::text AS asset_id, asset.title, event.note, event.operator_name, event.created_at
    FROM public.asset_scan_events event
    JOIN public.asset_register_items asset ON asset.id = event.asset_id
    JOIN public.dealer_maintenance_access access
      ON access.asset_register_item_id = asset.id AND access.owner_user_id = asset.user_id
    WHERE access.dealer_user_id = $1 AND access.is_active = true
      AND access.can_view_logged_problems = true
      AND coalesce(to_jsonb(asset)->>'lifecycle_state', 'active') = 'active'
      AND to_jsonb(event)->>'issue_noted_at' IS NULL
      AND event.created_at >= now() - interval '14 days'
      AND lower(coalesce(event.note, '')) LIKE '%notes%problems:%'
    ORDER BY event.id, access.id
  `, [dealerUserId]);
  return result.rows.flatMap(row => {
    const note = extractStandaloneIssueNoteText(row.note || '');
    if (!note) return [];
    const description = note.replace(/\s+/g, ' ').trim();
    return [{
      id: `reported-problem:${row.id}`,
      problemId: row.id,
      accessId: row.access_id,
      assetId: row.asset_id,
      maintenanceRecordId: '',
      status: 'reported_problem' as const,
      title: 'Problem reported',
      body: `${row.title || 'Tracked asset'} · ${row.operator_name || 'A user'}: ${description.length > 180 ? description.slice(0, 177) + '…' : description}`,
      isRead: false,
      isCurrent: true,
      assignedToViewer: false,
      createdAtIso: new Date(row.created_at).toISOString(),
    }];
  }).sort((a, b) => Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso)).slice(0, 50);
}
