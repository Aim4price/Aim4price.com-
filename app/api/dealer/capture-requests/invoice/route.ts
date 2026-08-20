import { NextResponse } from 'next/server';
import {
  addCaptureRequestFile,
  createCaptureRequest,
  transitionCaptureRequest,
  type CaptureEventActor,
} from '../../../../../lib/capture-requests';
import { toCaptureRequestStatusView } from '../../../../../lib/capture-request-view';
import { getAssetRegisterItemById } from '../../../../../lib/asset-register-db';
import {
  createAssetRegisterUpload,
  deleteUnreferencedAssetRegisterUploads,
} from '../../../../../lib/asset-register-uploads';
import { getDealerCostRequestContext } from '../../../../../lib/dealer-cost-request';
import { getDealerCostAssetAccess } from '../../../../../lib/dealer-costs';
import { validatePublicInvoiceFiles } from '../../../../../lib/public-invoice-drop-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTAKE_RECOVERY_ACTOR: CaptureEventActor = {
  actorType: 'system',
  displayName: 'Dealer assisted invoice intake recovery',
};

function fileEntry(value: FormDataEntryValue | null): File | null {
  return value && typeof value !== 'string' && typeof value.arrayBuffer === 'function' ? value : null;
}

export async function POST(request: Request) {
  const context = await getDealerCostRequestContext();
  if (!context) return NextResponse.json({ ok: false, error: 'Dealer sign-in is required.' }, { status: 401 });

  let formData: FormData;
  let unlinkedUploadUrl = '';
  let captureFileLinked = false;
  let createdCaptureId = '';
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid invoice upload.' }, { status: 400 });
  }
  const assetId = String(formData.get('assetId') ?? '').trim();
  const file = fileEntry(formData.get('file'));
  const access = assetId ? await getDealerCostAssetAccess(context.actor.dealerUserId, assetId) : null;
  if (!access) return NextResponse.json({ ok: false, error: 'This asset is not currently shared with your dealership.' }, { status: 404 });
  if (!file) return NextResponse.json({ ok: false, error: 'Attach an invoice or photo.' }, { status: 400 });

  try {
    const asset = await getAssetRegisterItemById(access.owner_user_id, assetId);
    if (!asset) return NextResponse.json({ ok: false, error: 'The selected asset could not be found.' }, { status: 404 });
    const [validated] = await validatePublicInvoiceFiles([file]);
    const upload = await createAssetRegisterUpload({
      userId: access.owner_user_id,
      file,
      category: 'dealer-assisted-invoice-capture',
    });
    unlinkedUploadUrl = upload.url;
    const actor = {
      actorType: 'dealer' as const,
      userId: context.actor.dealerUserId,
      displayName: context.actor.displayName || context.actor.supplierName || 'Dealer',
    };
    const capture = await createCaptureRequest({
      requestType: 'invoice',
      submissionChannel: 'dealer_upload',
      ownerUserId: access.owner_user_id,
      assetId,
      sender: {
        type: 'dealer',
        name: context.actor.displayName,
        businessName: context.actor.supplierName,
      },
      assetReference: asset.serialNumber,
      candidatePayload: {
        targetLabel: asset.title,
        dealerStaffId: context.actor.dealerStaffId,
      },
    }, actor);
    createdCaptureId = capture.id;
    await addCaptureRequestFile(capture.id, {
      storageKey: `v1/capture-quarantine/${validated.sha256.slice(0, 2)}/dealer-upload-${upload.id}`,
      originalFileName: validated.fileName,
      contentType: validated.contentType,
      byteSize: validated.byteSize,
      sha256: validated.sha256,
      promotedUploadId: upload.id,
    }, actor);
    captureFileLinked = true;

    return NextResponse.json({ ok: true, request: toCaptureRequestStatusView(capture) }, { status: 202 });
  } catch (error) {
    if (createdCaptureId && !captureFileLinked) {
      await transitionCaptureRequest(createdCaptureId, 'rejected', {
        actor: INTAKE_RECOVERY_ACTOR,
        reason: 'Dealer assisted invoice intake did not finish attaching its verified source file.',
      }).catch((recoveryError) => {
        console.error('Dealer assisted invoice request recovery failed.', { createdCaptureId, recoveryError });
      });
    }
    if (unlinkedUploadUrl && !captureFileLinked) {
      await deleteUnreferencedAssetRegisterUploads({
        userId: access.owner_user_id,
        uploadIds: [unlinkedUploadUrl],
      }).catch((cleanupError) => {
        console.error('Dealer assisted invoice orphan upload cleanup failed.', cleanupError);
      });
    }
    console.error('Dealer assisted invoice intake failed.', error);
    const message = error instanceof Error ? error.message : '';
    const safeMessage = message && !message.startsWith('CAPTURE_')
      ? message
      : 'The invoice could not be sent for capture. Please try again.';
    return NextResponse.json({ ok: false, error: safeMessage }, { status: 400 });
  }
}
