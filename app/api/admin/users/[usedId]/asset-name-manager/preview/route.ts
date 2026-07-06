import { NextRequest, NextResponse } from 'next/server';
import { isAim4priceAdminEmail } from '../../../../../../../lib/account-constants';
import { findAdminUserEmail } from '../../../../../../../lib/admin-users';
import { previewAdminAssetNameCsv } from '../../../../../../../lib/admin-asset-name-manager';
import { getAnyServerSession } from '../../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CSV_UPLOAD_BYTES = 5 * 1024 * 1024;

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

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'text' in value &&
      typeof (value as File).text === 'function'
  );
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

  try {
    await findAdminUserEmail(userId);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!isUploadedFile(file)) {
      return jsonError('Upload a CSV file.');
    }

    if (file.size > MAX_CSV_UPLOAD_BYTES) {
      return jsonError('CSV file is too large. Please upload a file smaller than 5 MB.');
    }

    const preview = await previewAdminAssetNameCsv(userId, await file.text());
    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    console.error('Failed to preview admin asset name CSV', error);
    return jsonError(
      error instanceof Error ? error.message : 'Failed to preview CSV.',
      500,
    );
  }
}
