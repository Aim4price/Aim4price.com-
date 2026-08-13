import { getDb } from './db';
import { getAssetRegisterItemsByRefs } from './asset-register-db';
import { ensureAssetRegisterTables, getAssetRegisterForUser } from './asset-registers';
import type { PoolClient } from 'pg';
import {
  normalizeAssetGroupRelationship,
  normalizeAssetGroupValueMode,
  type AssetGroup,
  type AssetGroupMember,
  type AssetGroupMemberRole,
  type AssetGroupRelationship,
  type AssetGroupSaveInput,
} from './asset-groups-shared';

type AssetGroupRow = {
  id: string;
  user_id: string;
  register_id: string | null;
  name: string;
  value_mode: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type AssetGroupMemberRow = {
  group_id: string;
  asset_id: string;
  role: string;
  relationship: string;
  counts_toward_total: boolean | null;
  sort_order: number | string | null;
};

const MAX_GROUP_NAME_LENGTH = 80;

export type MoveAssetToGroupInput = {
  assetId: string;
  targetGroupId: string;
  registerId: string | null;
  scope?: 'register' | 'combined';
};

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function iso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function mapMember(row: AssetGroupMemberRow): AssetGroupMember {
  const normalizedRole = cleanText(row.role).toLowerCase();
  const role: AssetGroupMemberRole = normalizedRole === 'primary'
    ? 'primary'
    : normalizedRole === 'linked'
      ? 'linked'
      : 'member';

  return {
    assetId: cleanText(row.asset_id),
    role,
    relationship: normalizeAssetGroupRelationship(row.relationship),
    countsTowardTotal: row.counts_toward_total !== false,
    sortOrder: Math.max(0, Math.round(Number(row.sort_order) || 0)),
  };
}

function mapGroups(rows: AssetGroupRow[], memberRows: AssetGroupMemberRow[]): AssetGroup[] {
  const membersByGroupId = new Map<string, AssetGroupMember[]>();

  memberRows.forEach((row) => {
    const groupId = cleanText(row.group_id);
    const current = membersByGroupId.get(groupId) ?? [];
    current.push(mapMember(row));
    membersByGroupId.set(groupId, current);
  });

  return rows
    .map((row) => ({
      id: cleanText(row.id),
      userId: cleanText(row.user_id),
      registerId: cleanText(row.register_id) || null,
      name: cleanText(row.name),
      valueMode: normalizeAssetGroupValueMode(row.value_mode),
      members: (membersByGroupId.get(cleanText(row.id)) ?? []).sort((left, right) => {
        if (left.role !== right.role) return left.role === 'primary' ? -1 : right.role === 'primary' ? 1 : 0;
        return left.sortOrder - right.sortOrder;
      }),
      createdAtIso: iso(row.created_at),
      updatedAtIso: iso(row.updated_at),
    }))
    .filter((group) => group.members.length >= 1);
}

function normalizeMemberIds(memberIds: unknown, primaryAssetId: string): string[] {
  const normalized = Array.from(
    new Set(
      (Array.isArray(memberIds) ? memberIds : [])
        .map((value) => cleanText(value))
        .filter(Boolean),
    ),
  );

  if (primaryAssetId && !normalized.includes(primaryAssetId)) {
    normalized.unshift(primaryAssetId);
  }

  return normalized;
}

function normalizeRelationships(
  memberIds: string[],
  primaryAssetId: string,
  relationships?: Record<string, AssetGroupRelationship>,
): Record<string, AssetGroupRelationship> {
  return Object.fromEntries(
    memberIds.map((assetId) => {
      if (assetId === primaryAssetId) return [assetId, 'primary'];
      const relationship = normalizeAssetGroupRelationship(relationships?.[assetId]);
      return [assetId, relationship === 'primary' || relationship === 'grouped' ? 'works_with' : relationship];
    }),
  );
}

function normalizeCountsTowardTotal(
  memberIds: string[],
  primaryAssetId: string,
  valueMode: unknown,
  countsTowardTotalByAssetId?: Record<string, boolean>,
): Record<string, boolean> {
  const legacyPrimaryOnly = normalizeAssetGroupValueMode(valueMode) === 'included_in_primary';

  return Object.fromEntries(memberIds.map((assetId) => {
    if (assetId === primaryAssetId) return [assetId, true];
    if (typeof countsTowardTotalByAssetId?.[assetId] === 'boolean') {
      return [assetId, countsTowardTotalByAssetId[assetId]];
    }
    return [assetId, !legacyPrimaryOnly];
  }));
}

function memberRole(
  assetId: string,
  primaryAssetId: string,
  countsTowardTotal: boolean,
): AssetGroupMemberRole {
  if (assetId === primaryAssetId) return 'primary';
  if (primaryAssetId && !countsTowardTotal) return 'linked';
  return 'member';
}

async function syncLegacyGroupValueMode(client: PoolClient, groupId: string): Promise<void> {
  await client.query(
    `update public.asset_groups asset_group
     set value_mode = case
           when exists (
             select 1 from public.asset_group_members member
             where member.group_id = asset_group.id and member.role = 'primary'
           ) and not exists (
             select 1 from public.asset_group_members member
             where member.group_id = asset_group.id
               and member.role <> 'primary'
               and member.counts_toward_total
           ) then 'included_in_primary'
           else 'separate'
         end,
         updated_at = now()
     where asset_group.id = $1::uuid`,
    [groupId],
  );
}

async function detachAssetsFromOtherGroups(
  client: PoolClient,
  userId: string,
  targetGroupId: string,
  memberIds: string[],
): Promise<void> {
  const conflicts = await client.query<{ group_id: string }>(
    `select distinct member.group_id::text
       from public.asset_group_members member
       inner join public.asset_groups asset_group on asset_group.id = member.group_id
       where member.asset_id = any($1::uuid[])
         and member.group_id <> $2::uuid
         and asset_group.user_id = $3
       order by member.group_id::text`,
    [memberIds, targetGroupId, userId],
  );
  const sourceGroupIds = conflicts.rows.map((row) => cleanText(row.group_id)).filter(Boolean);
  if (!sourceGroupIds.length) return;

  await client.query(
    `select id
       from public.asset_groups
       where id = any($1::uuid[]) and user_id = $2
       order by id
       for update`,
    [sourceGroupIds, userId],
  );
  await client.query(
    `delete from public.asset_group_members
     where group_id = any($1::uuid[])
       and asset_id = any($2::uuid[])`,
    [sourceGroupIds, memberIds],
  );

  for (const sourceGroupId of sourceGroupIds) {
    const remaining = await client.query<{ asset_id: string; role: string }>(
      `select asset_id::text, role
         from public.asset_group_members
         where group_id = $1::uuid
         order by sort_order, created_at, asset_id
         for update`,
      [sourceGroupId],
    );

    if (!remaining.rows.length) {
      await client.query(
        'delete from public.asset_groups where id = $1::uuid and user_id = $2',
        [sourceGroupId, userId],
      );
      continue;
    }

    if (!remaining.rows.some((member) => cleanText(member.role).toLowerCase() === 'primary')) {
      await client.query(
        `update public.asset_group_members
         set role = 'member', relationship = 'grouped'
         where group_id = $1::uuid and role = 'linked'`,
        [sourceGroupId],
      );
    }

    await syncLegacyGroupValueMode(client, sourceGroupId);
  }
}

export async function listAssetGroups(
  userId: string,
  registerId?: string | null,
): Promise<AssetGroup[]> {
  await ensureAssetRegisterTables();
  const db = getDb();
  const cleanedRegisterId = cleanText(registerId);
  const groupResult = await db.query<AssetGroupRow>(
    `select asset_group.id::text, asset_group.user_id, asset_group.register_id::text,
            asset_group.name, asset_group.value_mode, asset_group.created_at, asset_group.updated_at
       from public.asset_groups asset_group
       where asset_group.user_id = $1
         and (
           $2::text = ''
           or asset_group.register_id::text = $2
           or (
             asset_group.register_id is null
             and exists (
               select 1
               from public.asset_group_members group_member
               inner join public.asset_register_items asset
                 on asset.id = group_member.asset_id
               where group_member.group_id = asset_group.id
                 and asset.user_id = $1
                 and asset.register_id::text = $2
             )
           )
         )
       order by asset_group.updated_at desc, asset_group.created_at desc, asset_group.id desc`,
    [userId, cleanedRegisterId],
  );

  if (!groupResult.rows.length) return [];

  const groupIds = groupResult.rows.map((row) => row.id);
  const memberResult = await db.query<AssetGroupMemberRow>(
    `select group_id::text, asset_id::text, role, relationship, counts_toward_total, sort_order
       from public.asset_group_members
       where group_id = any($1::uuid[])
       order by group_id, case when role = 'primary' then 0 else 1 end, sort_order, created_at, asset_id`,
    [groupIds],
  );

  return mapGroups(groupResult.rows, memberResult.rows);
}

export async function getAssetGroupById(userId: string, groupId: string): Promise<AssetGroup | null> {
  const groups = await listAssetGroups(userId);
  return groups.find((group) => group.id === cleanText(groupId)) ?? null;
}

export async function saveAssetGroup(userId: string, input: AssetGroupSaveInput): Promise<AssetGroup> {
  await ensureAssetRegisterTables();

  const groupId = cleanText(input.groupId);
  const isCombinedScope = input.scope === 'combined';
  const registerId = isCombinedScope ? '' : cleanText(input.registerId);
  const storedRegisterId = registerId || null;
  const name = cleanText(input.name).slice(0, MAX_GROUP_NAME_LENGTH);
  const primaryAssetId = cleanText(input.primaryAssetId);
  const memberIds = normalizeMemberIds(input.memberIds, primaryAssetId);
  const countsTowardTotal = normalizeCountsTowardTotal(
    memberIds,
    primaryAssetId,
    input.valueMode,
    input.countsTowardTotalByAssetId,
  );
  const roles = Object.fromEntries(memberIds.map((assetId) => [
    assetId,
    memberRole(assetId, primaryAssetId, countsTowardTotal[assetId]),
  ])) as Record<string, AssetGroupMemberRole>;
  const valueMode = primaryAssetId
    && memberIds.every((assetId) => assetId === primaryAssetId || !countsTowardTotal[assetId])
    ? 'included_in_primary'
    : 'separate';

  if (!isCombinedScope && !registerId) throw new Error('ASSET_GROUP_REGISTER_REQUIRED');
  if (!name) throw new Error('ASSET_GROUP_NAME_REQUIRED');
  if (memberIds.length < 1) throw new Error('ASSET_GROUP_MEMBERS_REQUIRED');

  if (!isCombinedScope) {
    const register = await getAssetRegisterForUser(userId, registerId);
    if (!register) throw new Error('ASSET_GROUP_REGISTER_NOT_FOUND');
  }

  const assets = await getAssetRegisterItemsByRefs(memberIds.map((assetId) => ({ userId, assetId })));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  if (assetById.size !== memberIds.length) throw new Error('ASSET_GROUP_ASSET_NOT_FOUND');
  if (assets.some((asset) => !cleanText(asset.registerId))) {
    throw new Error('ASSET_GROUP_REGISTER_MISMATCH');
  }
  if (!isCombinedScope && assets.some((asset) => cleanText(asset.registerId) !== registerId)) {
    throw new Error('ASSET_GROUP_REGISTER_MISMATCH');
  }

  const relationships = normalizeRelationships(memberIds, primaryAssetId, input.relationships);
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('begin');

    let savedGroupId = groupId;

    if (groupId) {
      const existing = await client.query<{ id: string; register_id: string | null }>(
        `select id::text, register_id::text
           from public.asset_groups
           where id = $1::uuid and user_id = $2
           for update`,
        [groupId, userId],
      );

      if (!existing.rows[0]) throw new Error('ASSET_GROUP_NOT_FOUND');
      if (!isCombinedScope && cleanText(existing.rows[0].register_id) !== registerId) {
        throw new Error('ASSET_GROUP_REGISTER_MISMATCH');
      }

      await client.query(
        `update public.asset_groups
         set register_id = $2::uuid, name = $3, value_mode = $4, updated_at = now()
         where id = $1::uuid and user_id = $5`,
        [groupId, storedRegisterId, name, valueMode, userId],
      );
    } else {
      const created = await client.query<{ id: string }>(
        `insert into public.asset_groups (user_id, register_id, name, value_mode)
         values ($1, $2::uuid, $3, $4)
         returning id::text`,
        [userId, storedRegisterId, name, valueMode],
      );

      savedGroupId = cleanText(created.rows[0]?.id);
    }

    await detachAssetsFromOtherGroups(client, userId, savedGroupId, memberIds);

    await client.query(
      'delete from public.asset_group_members where group_id = $1::uuid',
      [savedGroupId],
    );

    await client.query(
      `insert into public.asset_group_members (
         group_id,
         asset_id,
         role,
         relationship,
         counts_toward_total,
         sort_order
       )
       select
         $1::uuid,
         member.asset_id::uuid,
         member.role,
         member.relationship,
         member.counts_toward_total,
         member.ordinality - 1
       from unnest($2::text[], $3::text[], $4::text[], $5::boolean[])
         with ordinality as member(asset_id, role, relationship, counts_toward_total, ordinality)`,
      [
        savedGroupId,
        memberIds,
        memberIds.map((assetId) => roles[assetId]),
        memberIds.map((assetId) => roles[assetId] === 'primary'
          ? 'primary'
          : roles[assetId] === 'linked'
            ? relationships[assetId]
            : 'grouped'),
        memberIds.map((assetId) => countsTowardTotal[assetId]),
      ],
    );

    await client.query('commit');

    const saved = await getAssetGroupById(userId, savedGroupId);
    if (!saved) throw new Error('ASSET_GROUP_SAVE_FAILED');
    return saved;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function moveAssetToGroup(
  userId: string,
  input: MoveAssetToGroupInput,
): Promise<AssetGroup> {
  await ensureAssetRegisterTables();

  const assetId = cleanText(input.assetId);
  const targetGroupId = cleanText(input.targetGroupId);
  const isCombinedScope = input.scope === 'combined';
  const registerId = isCombinedScope ? '' : cleanText(input.registerId);

  if (!assetId) throw new Error('ASSET_GROUP_ASSET_NOT_FOUND');
  if (!targetGroupId) throw new Error('ASSET_GROUP_NOT_FOUND');
  if (!isCombinedScope && !registerId) throw new Error('ASSET_GROUP_REGISTER_REQUIRED');

  const [asset] = await getAssetRegisterItemsByRefs([{ userId, assetId }]);
  if (!asset) throw new Error('ASSET_GROUP_ASSET_NOT_FOUND');
  if (!cleanText(asset.registerId)) {
    throw new Error('ASSET_GROUP_REGISTER_MISMATCH');
  }
  if (!isCombinedScope && cleanText(asset.registerId) !== registerId) {
    throw new Error('ASSET_GROUP_REGISTER_MISMATCH');
  }

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('begin');

    const sourceResult = await client.query<{ group_id: string; role: string }>(
      `select member.group_id::text, member.role
         from public.asset_group_members member
         inner join public.asset_groups asset_group on asset_group.id = member.group_id
         where member.asset_id = $1::uuid and asset_group.user_id = $2
         limit 1`,
      [assetId, userId],
    );
    const sourceMembership = sourceResult.rows[0];
    const groupIdsToLock = Array.from(new Set([
      targetGroupId,
      cleanText(sourceMembership?.group_id),
    ].filter(Boolean))).sort();
    const lockedGroups = await client.query<{ id: string; register_id: string | null }>(
      `select id::text, register_id::text
         from public.asset_groups
         where id = any($1::uuid[]) and user_id = $2
         order by id
         for update`,
      [groupIdsToLock, userId],
    );
    const targetGroup = lockedGroups.rows.find((group) => group.id === targetGroupId);

    if (!targetGroup) throw new Error('ASSET_GROUP_NOT_FOUND');
    if (!isCombinedScope && cleanText(targetGroup.register_id) !== registerId) {
      throw new Error('ASSET_GROUP_REGISTER_MISMATCH');
    }

    if (sourceMembership?.group_id === targetGroupId) {
      if (isCombinedScope && cleanText(targetGroup.register_id)) {
        await client.query(
          `update public.asset_groups
           set register_id = null, updated_at = now()
           where id = $1::uuid and user_id = $2`,
          [targetGroupId, userId],
        );
      }
      await client.query('commit');
      const unchanged = await getAssetGroupById(userId, targetGroupId);
      if (!unchanged) throw new Error('ASSET_GROUP_NOT_FOUND');
      return unchanged;
    }

    if (sourceMembership?.group_id) {
      const sourceGroupId = cleanText(sourceMembership.group_id);
      const sourceCountResult = await client.query<{ count: string }>(
        'select count(*)::text as count from public.asset_group_members where group_id = $1::uuid',
        [sourceGroupId],
      );
      const sourceMemberCount = Number(sourceCountResult.rows[0]?.count ?? 0);

      if (sourceMemberCount <= 1) {
        await client.query(
          'delete from public.asset_groups where id = $1::uuid and user_id = $2',
          [sourceGroupId, userId],
        );
      } else {
        await client.query(
          'delete from public.asset_group_members where group_id = $1::uuid and asset_id = $2::uuid',
          [sourceGroupId, assetId],
        );

        if (cleanText(sourceMembership.role).toLowerCase() === 'primary') {
          await client.query(
            `update public.asset_group_members
             set role = 'member', relationship = 'grouped'
             where group_id = $1::uuid and role = 'linked'`,
            [sourceGroupId],
          );
        }

        await syncLegacyGroupValueMode(client, sourceGroupId);
      }
    }

    await client.query(
      `insert into public.asset_group_members (
         group_id,
         asset_id,
         role,
         relationship,
         counts_toward_total,
         sort_order
       )
       select
         $1::uuid,
         $2::uuid,
         'member',
         'grouped',
         true,
         coalesce(max(sort_order), -1) + 1
       from public.asset_group_members
       where group_id = $1::uuid`,
      [targetGroupId, assetId],
    );
    await client.query(
      `update public.asset_groups
       set register_id = case when $3::boolean then null else register_id end,
           updated_at = now()
       where id = $1::uuid and user_id = $2`,
      [targetGroupId, userId, isCombinedScope],
    );
    await syncLegacyGroupValueMode(client, targetGroupId);

    await client.query('commit');

    const saved = await getAssetGroupById(userId, targetGroupId);
    if (!saved) throw new Error('ASSET_GROUP_NOT_FOUND');
    return saved;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteAssetGroup(userId: string, groupId: string): Promise<void> {
  await ensureAssetRegisterTables();
  const db = getDb();
  const result = await db.query(
    'delete from public.asset_groups where id = $1::uuid and user_id = $2',
    [cleanText(groupId), userId],
  );

  if (!result.rowCount) throw new Error('ASSET_GROUP_NOT_FOUND');
}

export async function pruneAssetGroups(userId: string): Promise<void> {
  await ensureAssetRegisterTables();
  const db = getDb();

  await db.query(
    `update public.asset_group_members member
     set role = 'member', relationship = 'grouped'
     from public.asset_groups asset_group
     where member.group_id = asset_group.id
       and asset_group.user_id = $1
       and member.role = 'linked'
       and not exists (
         select 1
         from public.asset_group_members primary_member
         where primary_member.group_id = member.group_id
           and primary_member.role = 'primary'
       )`,
    [userId],
  );

  await db.query(
    `update public.asset_groups asset_group
     set value_mode = case
           when exists (
             select 1 from public.asset_group_members member
             where member.group_id = asset_group.id and member.role = 'primary'
           ) and not exists (
             select 1 from public.asset_group_members member
             where member.group_id = asset_group.id
               and member.role <> 'primary'
               and member.counts_toward_total
           ) then 'included_in_primary'
           else 'separate'
         end
     where asset_group.user_id = $1`,
    [userId],
  );

  await db.query(
    `delete from public.asset_groups asset_group
     where asset_group.user_id = $1
       and (
         select count(*)
         from public.asset_group_members member
         where member.group_id = asset_group.id
       ) < 1`,
    [userId],
  );
}
