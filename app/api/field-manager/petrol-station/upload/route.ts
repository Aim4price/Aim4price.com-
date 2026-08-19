import { NextRequest, NextResponse } from 'next/server';
import {
  ALLOWED_ASSET_REGISTER_IMAGE_TYPES,
  MAX_ASSET_REGISTER_UPLOAD_BYTES,
  createAssetRegisterUpload,
} from '../../../../../lib/asset-register-uploads';
import { fieldManagerCan } from '../../../../../lib/field-manager';
import { requireActiveFieldManagerSession } from '../../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FormFile = File & {
  size: number;
  type: string;
  name: string;
};

function isUploadFile(value: FormDataEntryValue | null): value is FormFile {
  return Boolean(value && typeof value !== 'string' && typeof value.arrayBuffer === 'function');
}

export async function POST(request: NextRequest) {
  const access = await requireActiveFieldManagerSession(request);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  if (!(await fieldManagerCan(access.session.managerId, 'record_fuel'))) {
    return NextResponse.json(
      { ok: false, error: 'This Field Manager login cannot record fuel.' },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid fuel slip photo upload.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!isUploadFile(file)) {
    return NextResponse.json({ ok: false, error: 'Take or choose a fuel slip photo.' }, { status: 400 });
  }

  const contentType = String(file.type ?? '').trim().toLowerCase();
  if (!ALLOWED_ASSET_REGISTER_IMAGE_TYPES.has(contentType)) {
    return NextResponse.json({ ok: false, error: 'Upload a JPG, PNG or WEBP fuel slip photo.' }, { status: 400 });
  }

  if (!file.size || file.size > MAX_ASSET_REGISTER_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: 'The fuel slip photo is empty or too large.' }, { status: 400 });
  }

  try {
    const upload = await createAssetRegisterUpload({
      userId: access.session.ownerUserId,
      file,
      category: 'fuel-slip',
    });

    return NextResponse.json({
      ok: true,
      uploads: [{
        uploadId: upload.id,
        url: upload.url,
        fileName: upload.fileName,
        contentType: upload.contentType,
        byteSize: upload.byteSize,
      }],
    });
  } catch (error) {
    console.error('Aim4price Field Manager petrol-station fuel slip upload failed.', error);
    return NextResponse.json({ ok: false, error: 'The fuel slip photo could not be uploaded.' }, { status: 500 });
  }
}
