import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../lib/account-profile';
import {
  deleteAssetGroup,
  listAssetGroups,
  moveAssetToGroup,
  saveAssetGroup,
} from '../../../lib/asset-groups';
import { listAssetRegisterItems } from '../../../lib/asset-register-db';
import {
  projectAssetGroupsToAssets,
  type AssetGroup,
  type AssetGroupRelationship,
  type AssetGroupValueMode,
} from '../../../lib/asset-groups-shared';
import { getAssetRegisterForUser } from '../../../lib/asset-registers';
import {
  resolveOwnerWorkspaceContext,
  type OwnerWorkspaceContext,
} from '../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isCombinedGroupRequest(request: NextRequest, bodyScope?: unknown): boolean {
  return cleanText(bodyScope).toLowerCase() === 'combined'
    || cleanText(request.nextUrl.searchParams.get('scope')).toLowerCase() === 'combined';
}

async function requireGroupWriteAccess(
  context: OwnerWorkspaceContext,
): Promise<NextResponse | null> {
  if (context.accountantAccess) {
    if (!context.accountantAccess.allowDirectUpdates) {
      return NextResponse.json(
        { ok: false, error: 'This shared Asset Register is read-only.' },
        { status: 403 },
      );
    }

    return null;
  }

  const profile = await getAccountProfile({
    id: context.ownerUserId,
    name: context.actorName,
    email: context.actorEmail,
  });

  if (profile.accountType !== 'owner') {
    return NextResponse.json(
      { ok: false, error: 'Only Asset Register owners can create or change asset groups.' },
      { status: 403 },
    );
  }

  return null;
}

async function resolveRegisterId(
  request: NextRequest,
  ownerUserId: string,
  accountantRegisterId: string,
  bodyRegisterId?: unknown,
): Promise<string> {
  const requested = cleanText(bodyRegisterId)
    || cleanText(request.nextUrl.searchParams.get('registerId'))
    || cleanText(accountantRegisterId);

  if (!requested) throw new Error('ASSET_GROUP_REGISTER_REQUIRED');
  if (accountantRegisterId && requested !== accountantRegisterId) {
    throw new Error('ASSET_GROUP_REGISTER_FORBIDDEN');
  }

  const register = await getAssetRegisterForUser(ownerUserId, requested);
  if (!register) throw new Error('ASSET_GROUP_REGISTER_NOT_FOUND');
  return register.id;
}

async function listWorkspaceGroups(
  context: OwnerWorkspaceContext,
  registerId: string | null,
): Promise<AssetGroup[]> {
  const groups = await listAssetGroups(context.ownerUserId, registerId);

  if (!context.accountantAccess || !registerId) return groups;

  const items = await listAssetRegisterItems(context.ownerUserId, registerId);
  return projectAssetGroupsToAssets(groups, items);
}

function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : '';
  const status = message === 'ASSET_GROUP_NOT_FOUND' || message === 'ASSET_GROUP_REGISTER_NOT_FOUND'
    ? 404
    : message === 'ASSET_GROUP_REGISTER_FORBIDDEN'
      ? 403
      : 400;

  const friendly = message === 'ASSET_GROUP_REGISTER_REQUIRED'
    ? 'Choose an Asset Register before creating a group.'
    : message === 'ASSET_GROUP_REGISTER_NOT_FOUND'
      ? 'The selected Asset Register could not be found.'
      : message === 'ASSET_GROUP_REGISTER_FORBIDDEN'
        ? 'This Asset Register is not available in the current workspace.'
        : message === 'ASSET_GROUP_NAME_REQUIRED'
          ? 'Enter a clear name for this asset group.'
          : message === 'ASSET_GROUP_MEMBERS_REQUIRED'
            ? 'Choose at least one asset for an umbrella.'
            : message === 'ASSET_GROUP_ASSET_NOT_FOUND'
              ? 'One or more selected assets could not be found.'
              : message === 'ASSET_GROUP_REGISTER_MISMATCH'
                ? 'All grouped assets must belong to the same Asset Register.'
                : message.startsWith('ASSET_GROUP_ALREADY_LINKED:')
                  ? `An asset is already linked to ${message.split(':').slice(1).join(':') || 'another group'}.`
                  : message === 'ASSET_GROUP_NOT_FOUND'
                    ? 'The asset group could not be found.'
                    : 'The asset group could not be saved.';

  return NextResponse.json({ ok: false, error: friendly }, { status });
}

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request);
  if (!resolved.ok) return resolved.response;

  try {
    const combined = isCombinedGroupRequest(request);
    if (combined && resolved.context.accountantAccess) {
      throw new Error('ASSET_GROUP_REGISTER_FORBIDDEN');
    }
    const registerId = combined
      ? ''
      : await resolveRegisterId(
          request,
          resolved.context.ownerUserId,
          resolved.context.accountantRegisterId,
        );
    const groups = await listWorkspaceGroups(resolved.context, registerId);
    return NextResponse.json({ ok: true, groups });
  } catch (error) {
    return errorResponse(error);
  }
}

async function save(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request);
  if (!resolved.ok) return resolved.response;

  const accessError = await requireGroupWriteAccess(resolved.context);
  if (accessError) return accessError;

  try {
    const body = await request.json() as {
      groupId?: unknown;
      registerId?: unknown;
      name?: unknown;
      valueMode?: unknown;
      primaryAssetId?: unknown;
      memberIds?: unknown;
      countsTowardTotalByAssetId?: unknown;
      relationships?: unknown;
      scope?: unknown;
    };
    const combined = isCombinedGroupRequest(request, body.scope);
    if (combined && resolved.context.accountantAccess) {
      throw new Error('ASSET_GROUP_REGISTER_FORBIDDEN');
    }
    const registerId = combined
      ? null
      : await resolveRegisterId(
          request,
          resolved.context.ownerUserId,
          resolved.context.accountantRegisterId,
          body.registerId,
        );
    const relationships = body.relationships && typeof body.relationships === 'object' && !Array.isArray(body.relationships)
      ? body.relationships as Record<string, AssetGroupRelationship>
      : undefined;
    const countsTowardTotalByAssetId = body.countsTowardTotalByAssetId
      && typeof body.countsTowardTotalByAssetId === 'object'
      && !Array.isArray(body.countsTowardTotalByAssetId)
      ? body.countsTowardTotalByAssetId as Record<string, boolean>
      : undefined;
    const group = await saveAssetGroup(resolved.context.ownerUserId, {
      groupId: cleanText(body.groupId) || undefined,
      registerId,
      scope: combined ? 'combined' : 'register',
      name: cleanText(body.name),
      valueMode: cleanText(body.valueMode) as AssetGroupValueMode,
      primaryAssetId: cleanText(body.primaryAssetId),
      memberIds: Array.isArray(body.memberIds) ? body.memberIds.map(cleanText) : [],
      countsTowardTotalByAssetId,
      relationships,
    });
    const groups = await listWorkspaceGroups(resolved.context, combined ? null : registerId);

    return NextResponse.json({ ok: true, group, groups });
  } catch (error) {
    console.error('asset groups save failed', error);
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  return save(request);
}

export async function PUT(request: NextRequest) {
  return save(request);
}

export async function PATCH(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request);
  if (!resolved.ok) return resolved.response;

  const accessError = await requireGroupWriteAccess(resolved.context);
  if (accessError) return accessError;

  try {
    const body = await request.json() as {
      assetId?: unknown;
      targetGroupId?: unknown;
      registerId?: unknown;
      scope?: unknown;
    };
    const combined = isCombinedGroupRequest(request, body.scope);
    if (combined && resolved.context.accountantAccess) {
      throw new Error('ASSET_GROUP_REGISTER_FORBIDDEN');
    }
    const registerId = combined
      ? null
      : await resolveRegisterId(
          request,
          resolved.context.ownerUserId,
          resolved.context.accountantRegisterId,
          body.registerId,
        );
    const group = await moveAssetToGroup(resolved.context.ownerUserId, {
      assetId: cleanText(body.assetId),
      targetGroupId: cleanText(body.targetGroupId),
      registerId,
      scope: combined ? 'combined' : 'register',
    });
    const groups = await listWorkspaceGroups(resolved.context, combined ? null : registerId);

    return NextResponse.json({ ok: true, group, groups });
  } catch (error) {
    console.error('asset group drag and drop failed', error);
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request);
  if (!resolved.ok) return resolved.response;

  const accessError = await requireGroupWriteAccess(resolved.context);
  if (accessError) return accessError;

  try {
    const groupId = cleanText(request.nextUrl.searchParams.get('groupId'));
    if (!groupId) throw new Error('ASSET_GROUP_NOT_FOUND');

    const groupList = await listAssetGroups(resolved.context.ownerUserId);
    const group = groupList.find((entry) => entry.id === groupId);
    if (!group) throw new Error('ASSET_GROUP_NOT_FOUND');
    if (resolved.context.accountantRegisterId && group.registerId !== resolved.context.accountantRegisterId) {
      throw new Error('ASSET_GROUP_REGISTER_FORBIDDEN');
    }

    await deleteAssetGroup(resolved.context.ownerUserId, groupId);
    const groups = await listWorkspaceGroups(resolved.context, group.registerId);

    return NextResponse.json({ ok: true, groups });
  } catch (error) {
    console.error('asset groups delete failed', error);
    return errorResponse(error);
  }
}
