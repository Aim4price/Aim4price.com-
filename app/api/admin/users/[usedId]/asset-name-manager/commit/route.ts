import { NextRequest, NextResponse } from 'next/server';
import { isAim4priceAdminEmail } from '../../../../../../../lib/account-constants';
import { findAdminUserEmail } from '../../../../../../../lib/admin-users';
import {
  commitAdminAssetNameChanges,
  type AdminAssetNameCommitChange,
} from '../../../../../../../lib/admin-asset-name-manager';
import { getAnyServerSession } from '../../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_COMMIT_ROWS = 5000;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function requireAdminSession() {
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    return { response: jsonError('Not authenticated.', 401) };
  }

  if (!isAim4priceAdminEmail(session.user.email)) {
    return { response: jsonError('Admin access required.', 403) };
  }

  return { response: null };
}

function cleanUserId(value: unknown): string {
  return String(value ?? '').trim().slice(0, 200);
}

function readChanges(value: unknown): AdminAssetNameCommitChange[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is AdminAssetNameCommitChange => typeof entry === 'object' && entry !== null)
    .slice(0, MAX_COMMIT_ROWS);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } },
) {
  const { response } = await requireAdminSession();

  if (response) {
    return response;
  }

  const userId = cleanUserId(params.userId);

  if (!userId) {
    return jsonError('Missing user ID.');
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError('Invalid request body.');
  }

  const changes = readChanges(body.changes);

  if (!changes.length) {
    return jsonError('No name changes supplied.');
  }

  try {
    await findAdminUserEmail(userId);
    const result = await commitAdminAssetNameChanges(userId, changes);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('Failed to commit admin asset name changes', error);
    return jsonError(
      error instanceof Error ? error.message : 'Failed to commit name changes.',
      500,
    );
  }
}
