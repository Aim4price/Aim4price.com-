import { NextResponse } from 'next/server';
import {
  addCaptureRequestFile,
  createCaptureRequest,
  transitionCaptureRequest,
  type CaptureEventActor,
} from '../../../../lib/capture-requests';
import { toCaptureRequestStatusView } from '../../../../lib/capture-request-view';
import { getAssetRegisterItemById } from '../../../../lib/asset-register-db';
import {
  createAssetRegisterUpload,
  deleteUnreferencedAssetRegisterUploads,
} from '../../../../lib/asset-register-uploads';
import { getOwnerAppAccess, ownerAppCan, ownerAppCanAccessAsset } from '../../../../lib/owner-app-access';
import {
  assertWorkspaceAssetAccess,
  resolveOwnerWorkspaceContext,
} from '../../../../lib/owner-workspace-access';
import { validatePublicInvoiceFiles } from '../../../../lib/public-invoice-drop-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTAKE_RECOVERY_ACTOR: CaptureEventActor = {
  actorType: 'system',
  displayName: 'Assisted invoice intake recovery',
};

function fileEntry(value: FormDataEntryValue | null): File | null {
  return value && typeof value !== 'string' && typeof value.arrayBuffer === 'function' ? value : null;
}

export async function POST(request: Request) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost', requireWrite: true });
  if (!resolved.ok) return resolved.response;
  const { context } = resolved;
  const ownerAppAccess = context.accountantAccess ? null : await getOwnerAppAccess();
  if (!context.accountantAccess && !ownerAppAccess) {
    return NextResponse.json({ ok: false, error: 'Owner or shared accountant access is required.' }, { status: 403 });
  }
  if (ownerAppAccess?.sessionKind === 'owner-app-user' && !ownerAppCan(ownerAppAccess, 'manage_finance')) {
    return NextResponse.json({ ok: false, error: 'Only an Owner / Admin login can send invoices for capture.' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid invoice upload.' }, { status: 400 });
  }

  const assetId = String(formData.get('assetId') ?? '').trim();
  const file = fileEntry(formData.get('file'));
  if (!assetId) return NextResponse.json({ ok: false, error: 'Choose an asset first.' }, { status: 400 });
  if (!file) return NextResponse.json({ ok: false, error: 'Attach an invoice or photo.' }, { status: 400 });
  if (
    ownerAppAccess?.sessionKind === 'owner-app-user'
    && !ownerAppCanAccessAsset(ownerAppAccess, assetId)
  ) {
    return NextResponse.json({ ok: false, error: 'The selected asset could not be found.' }, { status: 404 });
  }

  let unlinkedUploadUrl = '';
  let captureFileLinked = false;
  let createdCaptureId = '';
  try {
    await assertWorkspaceAssetAccess(context, assetId);
    const asset = await getAssetRegisterItemById(context.ownerUserId, assetId);
    if (!asset) return NextResponse.json({ ok: false, error: 'The selected asset could not be found.' }, { status: 404 });

    const [validated] = await validatePublicInvoiceFiles([file]);
    const upload = await createAssetRegisterUpload({
      userId: context.ownerUserId,
      file,
      category: 'assisted-invoice-capture',
    });
    unlinkedUploadUrl = upload.url;
    const actor: CaptureEventActor = {
      actorType: context.accountantAccess ? 'accountant' : 'owner',
      userId: context.actorUserId,
      displayName: context.actorName || (context.accountantAccess ? 'Accountant' : 'Asset owner'),
    };
    const capture = await createCaptureRequest({
      requestType: 'invoice',
      submissionChannel: context.accountantAccess ? 'accountant_upload' : 'owner_upload',
      ownerUserId: context.ownerUserId,
      assetId,
      sender: {
        type: context.accountantAccess ? 'accountant' : 'owner',
        name: context.actorName,
        email: context.actorEmail,
      },
      assetReference: asset.serialNumber,
      requesterNote: String(formData.get('note') ?? '').trim().slice(0, 1000),
      candidatePayload: { targetLabel: asset.title },
    }, actor);
    createdCaptureId = capture.id;
    await addCaptureRequestFile(capture.id, {
      storageKey: `v1/capture-quarantine/${validated.sha256.slice(0, 2)}/owner-upload-${upload.id}`,
      originalFileName: validated.fileName,
      contentType: validated.contentType,
      byteSize: validated.byteSize,
      sha256: validated.sha256,
      promotedUploadId: upload.id,
    }, actor);
    captureFileLinked = true;

    return NextResponse.json({
      ok: true,
      request: toCaptureRequestStatusView(capture, { canRetract: actor.actorType === 'owner' }),
    }, { status: 202 });
  } catch (error) {
    if (createdCaptureId && !captureFileLinked) {
      await transitionCaptureRequest(createdCaptureId, 'rejected', {
        actor: INTAKE_RECOVERY_ACTOR,
        reason: 'Assisted invoice intake did not finish attaching its verified source file.',
      }).catch((recoveryError) => {
        console.error('Assisted invoice request recovery failed.', { createdCaptureId, recoveryError });
      });
    }
    if (unlinkedUploadUrl && !captureFileLinked) {
      await deleteUnreferencedAssetRegisterUploads({
        userId: context.ownerUserId,
        uploadIds: [unlinkedUploadUrl],
      }).catch((cleanupError) => {
        console.error('Assisted invoice orphan upload cleanup failed.', cleanupError);
      });
    }
    console.error('Aim4price assisted invoice intake failed.', error);
    const message = error instanceof Error ? error.message : '';
    const safeMessage = message && !message.startsWith('CAPTURE_')
      ? message
      : 'The invoice could not be sent for capture. Please try again.';
    return NextResponse.json({ ok: false, error: safeMessage }, { status: 400 });
  }
}

