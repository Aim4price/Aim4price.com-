import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import {
  getAssetRegisterItemById,
  updateAssetRegisterItemMedia,
  type AssetRegisterItem,
} from '../../../../../lib/asset-register-db';
import {
  ALLOWED_ASSET_REGISTER_IMAGE_TYPES,
  MAX_ASSET_REGISTER_PHOTOS,
  MAX_ASSET_REGISTER_UPLOAD_BYTES,
  createAssetRegisterUpload,
} from '../../../../../lib/asset-register-uploads';
import {
  getAssetLeadForPartner,
  updateAssetLeadPhotosForPartner,
  type AssetLead,
} from '../../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    leadId: string;
  };
};

type DealerLeadAssetContext = {
  dealerUserId: string;
  lead: AssetLead;
  asset: AssetRegisterItem;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function isFile(value: FormDataEntryValue): value is File {
  return typeof value !== 'string' && typeof value.arrayBuffer === 'function';
}

function assetResponse(asset: AssetRegisterItem) {
  return {
    id: asset.id,
    title: asset.title,
    publicAssetCode: asset.publicAssetCode,
    photos: asset.photos,
  };
}

async function resolveDealerLeadAsset(
  dealerUserId: string,
  leadId: string,
): Promise<DealerLeadAssetContext | null> {
  const profile = await getAccountProfile({ id: dealerUserId });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') return null;

  const lead = await getAssetLeadForPartner({ dealerUserId, leadId });
  if (!lead) return null;

  const asset = await getAssetRegisterItemById(lead.ownerUserId, lead.assetRegisterItemId);
  if (!asset) return null;

  return { dealerUserId, lead, asset };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) return unauthorized();

  try {
    const access = await resolveDealerLeadAsset(session.user.id, context.params.leadId);
    if (!access) {
      return NextResponse.json(
        { ok: false, error: 'This asset is not currently shared with your dealership.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, asset: assetResponse(access.asset) });
  } catch (error) {
    console.error('dealer lead asset media GET failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to load this asset.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) return unauthorized();

  try {
    const access = await resolveDealerLeadAsset(session.user.id, context.params.leadId);
    if (!access) {
      return NextResponse.json(
        { ok: false, error: 'This asset is not currently shared with your dealership.' },
        { status: 404 },
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files').filter(isFile);
    if (!files.length) {
      return NextResponse.json({ ok: false, error: 'Select at least one image file.' }, { status: 400 });
    }

    const remainingSlots = Math.max(0, MAX_ASSET_REGISTER_PHOTOS - access.asset.photos.length);
    if (files.length > remainingSlots) {
      return NextResponse.json(
        {
          ok: false,
          error: `This asset can have up to ${MAX_ASSET_REGISTER_PHOTOS} photos. You can add ${remainingSlots} more.`,
        },
        { status: 400 },
      );
    }

    for (const file of files) {
      const contentType = String(file.type ?? '').trim().toLowerCase();
      if (!ALLOWED_ASSET_REGISTER_IMAGE_TYPES.has(contentType)) {
        return NextResponse.json(
          { ok: false, error: 'Only JPG, PNG and WEBP photos are allowed.' },
          { status: 400 },
        );
      }

      if (!file.size) {
        return NextResponse.json({ ok: false, error: 'One of the photos is empty.' }, { status: 400 });
      }

      if (file.size > MAX_ASSET_REGISTER_UPLOAD_BYTES) {
        return NextResponse.json(
          {
            ok: false,
            error: `Each photo must be ${Math.round(MAX_ASSET_REGISTER_UPLOAD_BYTES / (1024 * 1024))} MB or smaller.`,
          },
          { status: 400 },
        );
      }
    }

    const uploads = [];
    for (const file of files) {
      const upload = await createAssetRegisterUpload({
        userId: access.lead.ownerUserId,
        file,
        category: 'lead-media',
      });
      uploads.push(upload);
    }

    const photos = [
      ...access.asset.photos,
      ...uploads.map((upload) => upload.url),
    ];
    const asset = await updateAssetRegisterItemMedia(access.lead.ownerUserId, {
      assetId: access.lead.assetRegisterItemId,
      photos,
    });
    await updateAssetLeadPhotosForPartner({
      dealerUserId: access.dealerUserId,
      leadId: access.lead.id,
      photos: asset.photos,
    });

    return NextResponse.json({
      ok: true,
      asset: assetResponse(asset),
      uploads: uploads.map((upload) => ({
        uploadId: upload.id,
        url: upload.url,
        fileName: upload.fileName,
        contentType: upload.contentType,
        byteSize: upload.byteSize,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'LEAD_NOT_FOUND') {
      return NextResponse.json(
        { ok: false, error: 'This asset is not currently shared with your dealership.' },
        { status: 404 },
      );
    }

    console.error('dealer lead asset media POST failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to upload asset photos.' }, { status: 500 });
  }
}
