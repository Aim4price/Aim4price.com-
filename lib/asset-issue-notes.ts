import { getDb } from './db';

type AssetIssueNoteRow = {
  id: string | number;
  asset_id: string | number | null;
  actor_type: string | null;
  operator_name: string | null;
  note: string | null;
  issue_noted_at?: string | null;
  created_at: string | Date | null;
};

type AssetIssueNoteOwnerRow = AssetIssueNoteRow & {
  asset_owner_user_id: string | null;
};

export type AssetIssueNoteStatus = {
  id: string;
  assetRegisterItemId: string;
  summary: string;
  note: string;
  operatorName: string;
  actorType: string;
  createdAtIso: string;
  notedAtIso: string | null;
};

export type AssetIssueNoteGroup = {
  assetRegisterItemId: string;
  latest: AssetIssueNoteStatus;
  earlierCount: number;
  totalCount: number;
};

const ISSUE_NOTE_PREFIX_PATTERN = /^notes\s*\/\s*problems\s*:\s*(.*)$/i;
const MAINTENANCE_METADATA_LINE_PATTERN = /^(?:checked|serviced|repaired|checked\s+items|work\s+done|company|mechanic|repair\s+details)\s*(?::|$)/i;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asId(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return value.toString();
  return '';
}

function asDateIso(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  return new Date().toISOString();
}

function splitScanNoteSections(note: string): string[] {
  return String(note ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*---\s*\n/g)
    .map((section) => section.trim())
    .filter(Boolean);
}

function splitIssueNoteLines(section: string): string[] {
  return String(section ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractStandaloneIssueNoteText(note: string): string {
  return splitScanNoteSections(note)
    .map((section) => {
      const lines = splitIssueNoteLines(section);
      const issueNotes: string[] = [];

      lines.forEach((line, lineIndex) => {
        const match = line.match(ISSUE_NOTE_PREFIX_PATTERN);
        if (!match) return;

        const noteLines = [match[1] ?? ''];

        for (let index = lineIndex + 1; index < lines.length; index += 1) {
          const continuationLine = lines[index] ?? '';

          if (
            ISSUE_NOTE_PREFIX_PATTERN.test(continuationLine)
            || MAINTENANCE_METADATA_LINE_PATTERN.test(continuationLine)
          ) {
            break;
          }

          noteLines.push(continuationLine);
        }

        const issueNote = noteLines
          .map((noteLine) => noteLine.trim())
          .filter(Boolean)
          .join('\n')
          .trim();

        if (issueNote) {
          issueNotes.push(issueNote);
        }
      });

      return issueNotes.join('\n\n').trim();
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function summarizeIssueNote(note: string): string {
  const singleLine = note.replace(/\s+/g, ' ').trim();

  if (!singleLine) {
    return 'Issue/problem note submitted.';
  }

  const truncated = singleLine.length > 140 ? `${singleLine.slice(0, 137).trim()}...` : singleLine;
  return `Issue reported: ${truncated}`;
}

function mapIssueNoteStatusFromScanEvent(row: AssetIssueNoteRow): AssetIssueNoteStatus | null {
  const note = extractStandaloneIssueNoteText(asText(row.note));
  const id = asId(row.id);
  const assetId = asId(row.asset_id);

  if (!id || !assetId || !note) {
    return null;
  }

  return {
    id,
    assetRegisterItemId: assetId,
    summary: summarizeIssueNote(note),
    note,
    operatorName: asText(row.operator_name),
    actorType: asText(row.actor_type),
    createdAtIso: asDateIso(row.created_at),
    notedAtIso: row.issue_noted_at ?? null,
  };
}

async function ensureAssetIssueNoteStorage(): Promise<boolean> {
  const db = getDb();
  const tableCheck = await db.query<{ table_name: string | null }>(
    `select to_regclass('public.asset_scan_events')::text as table_name`,
  );

  if (!tableCheck.rows[0]?.table_name) {
    return false;
  }

  await db.query(`
    alter table public.asset_scan_events
      add column if not exists issue_noted_at timestamptz
  `);

  return true;
}

export async function listOpenIssueNoteGroupsForAssets(
  assetIdsInput: string[],
): Promise<AssetIssueNoteGroup[]> {
  const assetIds = [...new Set(assetIdsInput.map((assetId) => asId(assetId)).filter(Boolean))];

  if (!assetIds.length) {
    return [];
  }

  const hasStorage = await ensureAssetIssueNoteStorage();

  if (!hasStorage) {
    return [];
  }

  const result = await getDb().query<AssetIssueNoteRow>(
    `
      select
        e.id,
        e.asset_id,
        e.actor_type,
        e.operator_name,
        e.note,
        e.issue_noted_at::text as issue_noted_at,
        e.created_at
      from public.asset_scan_events e
      where e.asset_id::text = any($1::text[])
        and e.issue_noted_at is null
        and nullif(trim(coalesce(e.note, '')), '') is not null
        and lower(coalesce(e.note, '')) like '%notes%problems:%'
      order by e.asset_id, e.created_at desc, e.id desc
    `,
    [assetIds],
  );

  const groupedByAssetId = new Map<string, AssetIssueNoteStatus[]>();

  result.rows.forEach((row) => {
    const issueStatus = mapIssueNoteStatusFromScanEvent(row);

    if (!issueStatus) {
      return;
    }

    const current = groupedByAssetId.get(issueStatus.assetRegisterItemId) ?? [];
    current.push(issueStatus);
    groupedByAssetId.set(issueStatus.assetRegisterItemId, current);
  });

  return [...groupedByAssetId.entries()].flatMap(([assetRegisterItemId, statuses]) => {
    const latest = statuses[0];
    if (!latest) return [];

    return [{
      assetRegisterItemId,
      latest,
      earlierCount: Math.max(0, statuses.length - 1),
      totalCount: statuses.length,
    }];
  });
}

export async function attachOpenIssueNoteStatusToAssets<T extends { id: string }>(
  assets: T[],
): Promise<Array<T & { latestIssueNoteStatus: AssetIssueNoteStatus | null }>> {
  if (!assets.length) {
    return [];
  }

  const assetIds = assets.map((asset) => asId(asset.id)).filter(Boolean);

  if (!assetIds.length) {
    return assets.map((asset) => ({ ...asset, latestIssueNoteStatus: null }));
  }

  const groups = await listOpenIssueNoteGroupsForAssets(assetIds);
  const latestByAssetId = new Map(
    groups.map((group) => [group.assetRegisterItemId, group.latest]),
  );

  return assets.map((asset) => ({
    ...asset,
    latestIssueNoteStatus: latestByAssetId.get(asset.id) ?? null,
  }));
}

function assetIssueNoteSelectSql(whereClause: string): string {
  return `
    select
      e.id,
      e.asset_id,
      e.actor_type,
      e.operator_name,
      e.note,
      e.issue_noted_at::text as issue_noted_at,
      e.created_at,
      a.user_id::text as asset_owner_user_id
    from public.asset_scan_events e
    inner join public.asset_register_items a
      on a.id = e.asset_id
    ${whereClause}
  `;
}

export async function markAssetIssueNoteStatusNoted(input: {
  currentUserId: string;
  issueNoteStatusId: string;
}): Promise<AssetIssueNoteStatus> {
  const hasStorage = await ensureAssetIssueNoteStorage();

  if (!hasStorage) {
    throw new Error('ISSUE_NOTE_STATUS_NOT_FOUND');
  }

  const db = getDb();
  const current = await db.query<AssetIssueNoteOwnerRow>(
    `${assetIssueNoteSelectSql('where e.id::text = $1')} limit 1`,
    [input.issueNoteStatusId],
  );
  const currentRow = current.rows[0] ?? null;
  const currentStatus = currentRow ? mapIssueNoteStatusFromScanEvent(currentRow) : null;

  if (!currentRow || !currentStatus || !currentStatus.assetRegisterItemId) {
    throw new Error('ISSUE_NOTE_STATUS_NOT_FOUND');
  }

  if (asText(currentRow.asset_owner_user_id) !== input.currentUserId) {
    throw new Error('ISSUE_NOTE_STATUS_FORBIDDEN');
  }

  await db.query(
    `
      update public.asset_scan_events
      set issue_noted_at = coalesce(issue_noted_at, now())
      where id::text = $1
    `,
    [input.issueNoteStatusId],
  );

  const updated = await db.query<AssetIssueNoteOwnerRow>(
    `${assetIssueNoteSelectSql('where e.id::text = $1')} limit 1`,
    [input.issueNoteStatusId],
  );
  const updatedStatus = updated.rows[0] ? mapIssueNoteStatusFromScanEvent(updated.rows[0]) : null;

  if (!updatedStatus) {
    throw new Error('ISSUE_NOTE_STATUS_NOT_FOUND');
  }

  return updatedStatus;
}
