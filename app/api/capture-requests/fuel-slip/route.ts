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
import { getFuelStorageById } from '../../../../lib/fuel-ledger';
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
  displayName: 'Assisted fuel slip intake recovery',
};

function fileEntry(value: FormDataEntryValue | null): File | null {
  return value && typeof value !== 'string' && typeof value.arrayBuffer === 'function' ? value : null;
}

function payloadObject(value: FormDataEntryValue | null): Record<string, unknown> {
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel', requireWrite: true });
  if (!resolved.ok) return resolved.response;
  const { context } = resolved;
  const ownerAppAccess = context.accountantAccess ? null : await getOwnerAppAccess();
  if (!context.accountantAccess && !ownerAppAccess) {
    return NextResponse.json({ ok: false, error: 'Owner or shared accountant access is required.' }, { status: 403 });
  }
  if (ownerAppAccess?.sessionKind === 'owner-app-user' && !ownerAppCan(ownerAppAccess, 'manage_finance')) {
    return NextResponse.json({ ok: false, error: 'Only an Owner / Admin login can send fuel slips for capture.' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid fuel slip upload.' }, { status: 400 });
  }

  const targetType = String(formData.get('targetType') ?? '').trim();
  const targetId = String(formData.get('targetId') ?? '').trim();
  const file = fileEntry(formData.get('file'));
  const submittedPayload = payloadObject(formData.get('submittedPayload'));
  if ((targetType !== 'asset' && targetType !== 'storage_tank') || !targetId) {
    return NextResponse.json({ ok: false, error: 'Choose an asset or storage tank first.' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ ok: false, error: 'Attach a fuel slip or photo.' }, { status: 400 });
  if (
    ownerAppAccess?.sessionKind === 'owner-app-user'
    && (
      targetType === 'asset'
        ? !ownerAppCanAccessAsset(ownerAppAccess, targetId)
        : ownerAppAccess.assetScope !== 'all'
    )
  ) {
    return NextResponse.json({ ok: false, error: 'The selected fuel target could not be found.' }, { status: 404 });
  }

  let unlinkedUploadUrl = '';
  let captureFileLinked = false;
  let createdCaptureId = '';
  try {
    const asset = targetType === 'asset'
      ? await getAssetRegisterItemById(context.ownerUserId, targetId)
      : null;
    const storage = targetType === 'storage_tank'
      ? await getFuelStorageById(context.ownerUserId, targetId)
      : null;
    if (targetType === 'asset') await assertWorkspaceAssetAccess(context, targetId);
    if ((targetType === 'asset' && !asset) || (targetType === 'storage_tank' && !storage)) {
      return NextResponse.json({ ok: false, error: 'The selected fuel target could not be found.' }, { status: 404 });
    }

    const targetLabel = asset?.title || storage?.name || 'Fuel slip';
    const [validated] = await validatePublicInvoiceFiles([file]);
    const upload = await createAssetRegisterUpload({
      userId: context.ownerUserId,
      file,
      category: 'assisted-fuel-slip-capture',
    });
    unlinkedUploadUrl = upload.url;
    const actor: CaptureEventActor = {
      actorType: context.accountantAccess ? 'accountant' : 'owner',
      userId: context.actorUserId,
      displayName: context.actorName || (context.accountantAccess ? 'Accountant' : 'Asset owner'),
    };
    const capture = await createCaptureRequest({
      requestType: 'fuel_slip',
      submissionChannel: context.accountantAccess ? 'accountant_upload' : 'owner_upload',
      ownerUserId: context.ownerUserId,
      assetId: asset?.id ?? null,
      fuelStorageId: storage?.id ?? null,
      sender: {
        type: context.accountantAccess ? 'accountant' : 'owner',
        name: context.actorName,
        email: context.actorEmail,
      },
      assetReference: asset?.serialNumber || storage?.publicFuelStorageCode || '',
      requesterNote: String(submittedPayload.note ?? '').trim(),
      candidatePayload: { ...submittedPayload, targetLabel },
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
        reason: 'Assisted fuel slip intake did not finish attaching its verified source file.',
      }).catch((recoveryError) => {
        console.error('Assisted fuel slip request recovery failed.', { createdCaptureId, recoveryError });
      });
    }
    if (unlinkedUploadUrl && !captureFileLinked) {
      await deleteUnreferencedAssetRegisterUploads({
        userId: context.ownerUserId,
        uploadIds: [unlinkedUploadUrl],
      }).catch((cleanupError) => {
        console.error('Assisted fuel slip orphan upload cleanup failed.', cleanupError);
      });
    }
    console.error('Aim4price assisted fuel slip intake failed.', error);
    const message = error instanceof Error ? error.message : '';
    const safeMessage = message && !message.startsWith('CAPTURE_')
      ? message
      : 'The fuel slip could not be sent for capture. Please try again.';
    return NextResponse.json({ ok: false, error: safeMessage }, { status: 400 });
  }
}
