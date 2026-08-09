import { getDb } from './db';
import { getAssetRegisterItemsByRefs } from './asset-register-db';
import { ensureAssetRegisterTables, getAssetRegisterForUser } from './asset-registers';
import {
  normalizeAssetGroupRelationship,
  normalizeAssetGroupValueMode,
  type AssetGroup,
  type AssetGroupMember,
  type AssetGroupRelationship,
  type AssetGroupSaveInput,
} from './asset-groups-shared';

type AssetGroupRow = {
  id: string;
  user_id: string;
  register_id: string;
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
  sort_order: number | string | null;
};

const MAX_GROUP_NAME_LENGTH = 80;
const MAX_GROUP_MEMBERS = 50;

export type MoveAssetToGroupInput = {
  assetId: string;
  targetGroupId: string;
  registerId: string;
};

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function iso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function mapMember(row: AssetGroupMemberRow): AssetGroupMember {
  return {
    assetId: cleanText(row.asset_id),
    role: cleanText(row.role).toLowerCase() === 'primary' ? 'primary' : 'linked',
    relationship: normalizeAssetGroupRelationship(row.relationship),
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
      registerId: cleanText(row.register_id),
      name: cleanText(row.name),
      valueMode: normalizeAssetGroupValueMode(row.value_mode),
      members: (membersByGroupId.get(cleanText(row.id)) ?? []).sort((left, right) => {
        if (left.role !== right.role) return left.role === 'primary' ? -1 : 1;
        return left.sortOrder - right.sortOrder;
      }),
      createdAtIso: iso(row.created_at),
      updatedAtIso: iso(row.updated_at),
    }))
    .filter((group) => group.members.length >= 2);
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
      return [assetId, relationship === 'primary' ? 'works_with' : relationship];
    }),
  );
}

export async function listAssetGroups(
  userId: string,
  registerId?: string | null,
): Promise<AssetGroup[]> {
  await ensureAssetRegisterTables();
  const db = getDb();
  const cleanedRegisterId = cleanText(registerId);
  const groupResult = await db.query<AssetGroupRow>(
    `select id::text, user_id, register_id::text, name, value_mode, created_at, updated_at
       from public.asset_groups
       where user_id = $1
         and ($2::text = '' or register_id::text = $2)
       order by updated_at desc, created_at desc, id desc`,
    [userId, cleanedRegisterId],
  );

  if (!groupResult.rows.length) return [];

  const groupIds = groupResult.rows.map((row) => row.id);
  const memberResult = await db.query<AssetGroupMemberRow>(
    `select group_id::text, asset_id::text, role, relationship, sort_order
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
  const registerId = cleanText(input.registerId);
  const name = cleanText(input.name).slice(0, MAX_GROUP_NAME_LENGTH);
  const primaryAssetId = cleanText(input.primaryAssetId);
  const memberIds = normalizeMemberIds(input.memberIds, primaryAssetId);
  const valueMode = normalizeAssetGroupValueMode(input.valueMode);

  if (!registerId) throw new Error('ASSET_GROUP_REGISTER_REQUIRED');
  if (!name) throw new Error('ASSET_GROUP_NAME_REQUIRED');
  if (!primaryAssetId) throw new Error('ASSET_GROUP_PRIMARY_REQUIRED');
  if (memberIds.length < 2) throw new Error('ASSET_GROUP_MEMBERS_REQUIRED');
  if (memberIds.length > MAX_GROUP_MEMBERS) throw new Error('ASSET_GROUP_TOO_MANY_MEMBERS');

  const register = await getAssetRegisterForUser(userId, registerId);
  if (!register) throw new Error('ASSET_GROUP_REGISTER_NOT_FOUND');

  const assets = await getAssetRegisterItemsByRefs(memberIds.map((assetId) => ({ userId, assetId })));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  if (assetById.size !== memberIds.length) throw new Error('ASSET_GROUP_ASSET_NOT_FOUND');
  if (assets.some((asset) => cleanText(asset.registerId) !== registerId)) {
    throw new Error('ASSET_GROUP_REGISTER_MISMATCH');
  }

  const relationships = normalizeRelationships(memberIds, primaryAssetId, input.relationships);
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('begin');

    let savedGroupId = groupId;

    if (groupId) {
      const existing = await client.query<{ id: string }>(
        `select id::text
           from public.asset_groups
           where id = $1::uuid and user_id = $2 and register_id = $3::uuid
           for update`,
        [groupId, userId, registerId],
      );

      if (!existing.rows[0]) throw new Error('ASSET_GROUP_NOT_FOUND');

      await client.query(
        `update public.asset_groups
         set name = $2, value_mode = $3, updated_at = now()
         where id = $1::uuid and user_id = $4`,
        [groupId, name, valueMode, userId],
      );
    } else {
      const created = await client.query<{ id: string }>(
        `insert into public.asset_groups (user_id, register_id, name, value_mode)
         values ($1, $2::uuid, $3, $4)
         returning id::text`,
        [userId, registerId, name, valueMode],
      );

      savedGroupId = cleanText(created.rows[0]?.id);
    }

    const conflicts = await client.query<{ asset_id: string; group_name: string }>(
      `select member.asset_id::text, asset_group.name as group_name
       from public.asset_group_members member
       inner join public.asset_groups asset_group on asset_group.id = member.group_id
       where member.asset_id = any($1::uuid[])
         and member.group_id <> $2::uuid
       limit 1`,
      [memberIds, savedGroupId],
    );

    if (conflicts.rows[0]) {
      const conflictName = cleanText(conflicts.rows[0].group_name) || 'another group';
      throw new Error(`ASSET_GROUP_ALREADY_LINKED:${conflictName}`);
    }

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
         sort_order
       )
       select
         $1::uuid,
         member.asset_id::uuid,
         case when member.asset_id = $2 then 'primary' else 'linked' end,
         case when member.asset_id = $2 then 'primary' else member.relationship end,
         member.ordinality - 1
       from unnest($3::text[], $4::text[]) with ordinality as member(asset_id, relationship, ordinality)`,
      [
        savedGroupId,
        primaryAssetId,
        memberIds,
        memberIds.map((assetId) => relationships[assetId]),
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
  const registerId = cleanText(input.registerId);

  if (!assetId) throw new Error('ASSET_GROUP_ASSET_NOT_FOUND');
  if (!targetGroupId) throw new Error('ASSET_GROUP_NOT_FOUND');
  if (!registerId) throw new Error('ASSET_GROUP_REGISTER_REQUIRED');

  const [asset] = await getAssetRegisterItemsByRefs([{ userId, assetId }]);
  if (!asset) throw new Error('ASSET_GROUP_ASSET_NOT_FOUND');
  if (cleanText(asset.registerId) !== registerId) {
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
    const lockedGroups = await client.query<{ id: string; register_id: string }>(
      `select id::text, register_id::text
         from public.asset_groups
         where id = any($1::uuid[]) and user_id = $2
         order by id
         for update`,
      [groupIdsToLock, userId],
    );
    const targetGroup = lockedGroups.rows.find((group) => group.id === targetGroupId);

    if (!targetGroup) throw new Error('ASSET_GROUP_NOT_FOUND');
    if (cleanText(targetGroup.register_id) !== registerId) {
      throw new Error('ASSET_GROUP_REGISTER_MISMATCH');
    }

    if (sourceMembership?.group_id === targetGroupId) {
      await client.query('commit');
      const unchanged = await getAssetGroupById(userId, targetGroupId);
      if (!unchanged) throw new Error('ASSET_GROUP_NOT_FOUND');
      return unchanged;
    }

    const targetCountResult = await client.query<{ count: string }>(
      'select count(*)::text as count from public.asset_group_members where group_id = $1::uuid',
      [targetGroupId],
    );
    if (Number(targetCountResult.rows[0]?.count ?? 0) >= MAX_GROUP_MEMBERS) {
      throw new Error('ASSET_GROUP_TOO_MANY_MEMBERS');
    }

    if (sourceMembership?.group_id) {
      const sourceGroupId = cleanText(sourceMembership.group_id);
      const sourceCountResult = await client.query<{ count: string }>(
        'select count(*)::text as count from public.asset_group_members where group_id = $1::uuid',
        [sourceGroupId],
      );
      const sourceMemberCount = Number(sourceCountResult.rows[0]?.count ?? 0);

      if (sourceMemberCount <= 2) {
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
          const replacementPrimary = await client.query<{ asset_id: string }>(
            `select asset_id::text
               from public.asset_group_members
               where group_id = $1::uuid
               order by sort_order, created_at, asset_id
               limit 1`,
            [sourceGroupId],
          );
          const replacementPrimaryAssetId = cleanText(replacementPrimary.rows[0]?.asset_id);

          if (replacementPrimaryAssetId) {
            await client.query(
              `update public.asset_group_members
               set role = 'primary', relationship = 'primary'
               where group_id = $1::uuid and asset_id = $2::uuid`,
              [sourceGroupId, replacementPrimaryAssetId],
            );
          }
        }

        await client.query(
          'update public.asset_groups set updated_at = now() where id = $1::uuid and user_id = $2',
          [sourceGroupId, userId],
        );
      }
    }

    await client.query(
      `insert into public.asset_group_members (
         group_id,
         asset_id,
         role,
         relationship,
         sort_order
       )
       select
         $1::uuid,
         $2::uuid,
         'linked',
         'works_with',
         coalesce(max(sort_order), -1) + 1
       from public.asset_group_members
       where group_id = $1::uuid`,
      [targetGroupId, assetId],
    );
    await client.query(
      'update public.asset_groups set updated_at = now() where id = $1::uuid and user_id = $2',
      [targetGroupId, userId],
    );

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
    `delete from public.asset_groups asset_group
     where asset_group.user_id = $1
       and (
         (
           select count(*)
           from public.asset_group_members member
           where member.group_id = asset_group.id
         ) < 2
         or not exists (
           select 1
           from public.asset_group_members member
           where member.group_id = asset_group.id
             and member.role = 'primary'
         )
       )`,
    [userId],
  );
}
