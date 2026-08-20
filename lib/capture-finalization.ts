import { createHash } from 'node:crypto';
import {
  createAssetRegisterUpload,
  deleteUnreferencedAssetRegisterUploads,
  resolveAssetRegisterUploadBytes,
} from './asset-register-uploads';
import {
  deleteCaptureQuarantineFile,
  readCaptureQuarantineFile,
} from './capture-quarantine-storage';
import {
  completeCaptureRequest,
  getCaptureRequestDetail,
  transitionCaptureRequest,
  type CaptureAdminActor,
  type CaptureEventActor,
  type CaptureRequest,
  type CaptureRequestDetail,
  type CaptureRequestFile,
} from './capture-requests';
import { getDb } from './db';
import {
  listFuelAssetsForUser,
  saveFuelSlipTransaction,
} from './fuel-ledger';
import {
  createInvoiceDocumentRecord,
  createMyInvoice,
  type MyInvoiceActorContext,
  type MyInvoiceUsageMetric,
} from './my-invoices';

export type CaptureFinalizationOutcome = {
  request: CaptureRequest;
  outcome: 'completed' | 'awaiting_owner';
  outputId?: string;
};

export type NormalizedInvoiceCapture = {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotalExVat: number | null;
  vatAmount: number | null;
  totalIncVat: number;
  usageReading: number | null;
  usageMetric: MyInvoiceUsageMetric;
  maintenanceWorkDone: string;
  partsSupplied: string;
  repairWorkDone: string;
  notes: string;
};

export type NormalizedFuelCapture = {
  supplierName: string;
  slipNumber: string;
  documentDate: string;
  fuelType: string;
  litres: number;
  totalAmount: number;
  vatAmount: number | null;
  pricePerLitre: number | null;
  odometerReading: number | null;
  hourMeterReading: number | null;
  operatorName: string;
  activityText: string;
  workAreaText: string;
  note: string;
  assetFuelPercentBefore: number | null;
  assetFuelPercentAfter: number | null;
};

const EXTERNAL_CHANNELS = new Set(['dealer_upload', 'public_drop']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value: unknown, maxLength = 2_000): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function firstText(payload: Record<string, unknown>, keys: string[], maxLength = 2_000): string {
  for (const key of keys) {
    const value = text(payload[key], maxLength);
    if (value) return value;
  }
  return '';
}

function decimal(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null;
  let normalized = text(value, 80)
    .replace(/zar|rand/gi, '')
    .replace(/[^0-9, .-]/g, '')
    .replace(/\s+/g, '');
  if (!/[0-9]/.test(normalized)) return null;
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (normalized.includes(',') && !normalized.includes('.')) {
    const parts = normalized.split(',');
    const last = parts.at(-1) ?? '';
    normalized = last.length === 2
      ? `${parts.slice(0, -1).join('')}.${last}`
      : normalized.replace(/,/g, '');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 10000) / 10000 : null;
}

function firstDecimal(payload: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = decimal(payload[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function dateOnly(value: unknown): string {
  const normalized = text(value, 30);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    ? normalized
    : '';
}

function optionalNonNegative(value: unknown): number | null {
  const parsed = decimal(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function requiredPositive(value: unknown, errorCode: string): number {
  const parsed = decimal(value);
  if (parsed === null || parsed <= 0) throw new Error(errorCode);
  return parsed;
}

function percentage(value: unknown): number | null {
  const parsed = decimal(value);
  return parsed === null ? null : Math.max(0, Math.min(100, Math.round(parsed)));
}

function invoiceUsageMetric(value: unknown): MyInvoiceUsageMetric {
  const normalized = text(value, 30).toLowerCase();
  if (normalized === 'hours' || normalized === 'km' || normalized === 'percentage') return normalized;
  return 'none';
}

export function normalizeInvoiceCapturePayload(
  capturedPayload: Record<string, unknown>,
  candidatePayload: Record<string, unknown> = {},
  requesterNote = '',
): NormalizedInvoiceCapture {
  const supplierName = firstText(capturedPayload, ['supplierName', 'supplier'], 180);
  const invoiceNumber = firstText(capturedPayload, ['invoiceNumber', 'slipNumber', 'documentNumber'], 120);
  const invoiceDate = dateOnly(capturedPayload.invoiceDate ?? capturedPayload.documentDate);
  const totalIncVat = requiredPositive(
    capturedPayload.totalIncVat ?? capturedPayload.totalAmount ?? capturedPayload.total,
    'CAPTURE_INVOICE_TOTAL_REQUIRED',
  );
  if (!supplierName) throw new Error('CAPTURE_INVOICE_SUPPLIER_REQUIRED');
  if (!invoiceNumber) throw new Error('CAPTURE_INVOICE_NUMBER_REQUIRED');
  if (!invoiceDate) throw new Error('CAPTURE_INVOICE_DATE_REQUIRED');

  let subtotalExVat = firstDecimal(capturedPayload, ['subtotalExVat', 'subtotal']);
  let vatAmount = firstDecimal(capturedPayload, ['vatAmount', 'vat']);
  if (subtotalExVat !== null && subtotalExVat < 0) subtotalExVat = null;
  if (vatAmount !== null && vatAmount < 0) vatAmount = null;
  if (subtotalExVat === null && vatAmount !== null) subtotalExVat = Math.max(0, totalIncVat - vatAmount);
  if (vatAmount === null && subtotalExVat !== null) vatAmount = Math.max(0, totalIncVat - subtotalExVat);
  if (subtotalExVat !== null && subtotalExVat > totalIncVat + 0.01) {
    throw new Error('CAPTURE_INVOICE_TOTALS_INVALID');
  }
  if (vatAmount !== null && vatAmount > totalIncVat + 0.01) {
    throw new Error('CAPTURE_INVOICE_TOTALS_INVALID');
  }

  const usageMetric = invoiceUsageMetric(capturedPayload.usageMetric ?? candidatePayload.usageMetric);
  const usageReading = usageMetric === 'none'
    ? null
    : optionalNonNegative(capturedPayload.usageReading ?? candidatePayload.usageReading);

  return {
    supplierName,
    invoiceNumber,
    invoiceDate,
    subtotalExVat,
    vatAmount,
    totalIncVat: Math.round(totalIncVat * 100) / 100,
    usageReading,
    usageMetric,
    maintenanceWorkDone: firstText(capturedPayload, ['maintenanceWorkDone', 'maintenance'], 5_000),
    partsSupplied: firstText(capturedPayload, ['partsSupplied', 'parts'], 5_000),
    repairWorkDone: firstText(capturedPayload, ['repairWorkDone', 'repair'], 5_000),
    notes: firstText(capturedPayload, ['notes', 'description'], 5_000) || text(requesterNote, 5_000),
  };
}

export function normalizeFuelCapturePayload(
  capturedPayload: Record<string, unknown>,
  candidatePayload: Record<string, unknown> = {},
): NormalizedFuelCapture {
  const supplierName = firstText(capturedPayload, ['supplierName', 'supplier'], 180);
  const documentDate = dateOnly(capturedPayload.documentDate ?? capturedPayload.invoiceDate);
  const fuelType = firstText(capturedPayload, ['fuelType'], 120);
  if (!supplierName) throw new Error('CAPTURE_FUEL_SUPPLIER_REQUIRED');
  if (!documentDate) throw new Error('CAPTURE_FUEL_DATE_REQUIRED');
  if (!fuelType) throw new Error('CAPTURE_FUEL_TYPE_REQUIRED');

  const litres = requiredPositive(capturedPayload.litres, 'CAPTURE_FUEL_LITRES_REQUIRED');
  const totalAmount = requiredPositive(
    capturedPayload.totalAmount ?? capturedPayload.totalIncVat ?? capturedPayload.total,
    'CAPTURE_FUEL_TOTAL_REQUIRED',
  );
  const vatAmount = optionalNonNegative(capturedPayload.vatAmount ?? capturedPayload.vat);
  if (vatAmount !== null && vatAmount > totalAmount + 0.01) throw new Error('CAPTURE_FUEL_TOTALS_INVALID');
  const explicitRate = optionalNonNegative(capturedPayload.pricePerLitre);
  const reviewedUsage = optionalNonNegative(capturedPayload.usageReading);
  const usageMetric = text(capturedPayload.usageMetric ?? candidatePayload.usageMetric, 30).toLowerCase();
  let odometerReading = optionalNonNegative(capturedPayload.odometerReading ?? candidatePayload.odometerReading);
  let hourMeterReading = optionalNonNegative(capturedPayload.hourMeterReading ?? candidatePayload.hourMeterReading);
  if (reviewedUsage !== null) {
    if (usageMetric === 'km') odometerReading = reviewedUsage;
    if (usageMetric === 'hours') hourMeterReading = reviewedUsage;
    if (usageMetric === 'both') {
      if (odometerReading !== null && hourMeterReading === null) odometerReading = reviewedUsage;
      else hourMeterReading = reviewedUsage;
    }
  }

  return {
    supplierName,
    slipNumber: firstText(capturedPayload, ['slipNumber', 'invoiceNumber', 'transactionNumber'], 120),
    documentDate,
    fuelType,
    litres,
    totalAmount: Math.round(totalAmount * 100) / 100,
    vatAmount,
    pricePerLitre: explicitRate ?? Math.round((totalAmount / litres) * 10_000) / 10_000,
    odometerReading,
    hourMeterReading,
    operatorName: firstText(capturedPayload, ['operatorName'], 100)
      || firstText(candidatePayload, ['operatorName'], 100),
    activityText: firstText(capturedPayload, ['activityText', 'activity'], 180)
      || firstText(candidatePayload, ['activityText'], 180),
    workAreaText: firstText(capturedPayload, ['workAreaText'], 180)
      || firstText(candidatePayload, ['workAreaText'], 180),
    note: firstText(capturedPayload, ['note'], 1_000)
      || firstText(candidatePayload, ['note'], 1_000),
    assetFuelPercentBefore: percentage(
      capturedPayload.assetFuelPercentBefore ?? candidatePayload.assetFuelPercentBefore,
    ),
    assetFuelPercentAfter: percentage(
      capturedPayload.assetFuelPercentAfter ?? candidatePayload.assetFuelPercentAfter,
    ),
  };
}

function assertRequestId(requestId: string): string {
  const normalized = text(requestId, 80);
  if (!UUID_PATTERN.test(normalized)) throw new Error('CAPTURE_REQUEST_NOT_FOUND');
  return normalized;
}

async function withFinalizationLock<T>(requestIdInput: string, work: () => Promise<T>): Promise<T> {
  const requestId = assertRequestId(requestIdInput);
  const client = await getDb().connect();
  let locked = false;
  try {
    await client.query(`select pg_advisory_lock(hashtextextended($1, 0))`, [`capture-finalization:${requestId}`]);
    locked = true;
    return await work();
  } finally {
    if (locked) {
      await client.query(`select pg_advisory_unlock(hashtextextended($1, 0))`, [`capture-finalization:${requestId}`])
        .catch(() => null);
    }
    client.release();
  }
}

export async function readVerifiedCaptureFileBytes(file: CaptureRequestFile): Promise<Buffer> {
  let bytes: Buffer;
  if (file.promotedUploadId) {
    const resolved = await resolveAssetRegisterUploadBytes(file.promotedUploadId);
    if (resolved.status === 'not-found') throw new Error('CAPTURE_FILE_NOT_FOUND');
    if (resolved.status === 'unavailable') throw new Error('CAPTURE_FILE_UNAVAILABLE');
    bytes = resolved.upload.data;
  } else {
    bytes = await readCaptureQuarantineFile({
      storageKey: file.storageKey,
      expectedByteSize: file.byteSize,
      expectedSha256: file.sha256,
    });
  }
  if (
    bytes.length !== file.byteSize
    || createHash('sha256').update(bytes).digest('hex') !== file.sha256
  ) {
    throw new Error('CAPTURE_FILE_INTEGRITY_FAILED');
  }
  return bytes;
}

async function promoteCaptureFile(
  request: CaptureRequestDetail,
  file: CaptureRequestFile,
): Promise<CaptureRequestFile> {
  if (!request.ownerUserId) throw new Error('CAPTURE_OWNER_REQUIRED');
  if (file.securityStatus !== 'clean') throw new Error('CAPTURE_CLEAN_FILE_REQUIRED');
  const bytes = await readVerifiedCaptureFileBytes(file);
  if (file.promotedUploadId) return file;

  const upload = await createAssetRegisterUpload({
    userId: request.ownerUserId,
    file: new File([new Uint8Array(bytes)], file.originalFileName, { type: file.contentType }),
    category: request.requestType === 'invoice'
      ? 'assisted-invoice-capture'
      : 'assisted-fuel-slip-capture',
  });
  const cleanupUnlinkedUpload = async () => {
    await deleteUnreferencedAssetRegisterUploads({
      userId: request.ownerUserId ?? '',
      uploadIds: [upload.url],
    }).catch((error) => {
      // Migration 84's attachment queue remains as the crash-safe fallback if
      // immediate catalog cleanup is temporarily unavailable.
      console.error('Unlinked promoted capture upload cleanup failed.', {
        requestId: request.id,
        fileId: file.id,
        uploadId: upload.id,
        error,
      });
    });
  };

  let promotedUploadId: string | null = null;
  try {
    const updated = await getDb().query<{ promoted_upload_id: string }>(
      `update public.document_capture_files
          set promoted_upload_id = $3
        where id = $1::uuid
          and capture_request_id = $2::uuid
          and promoted_upload_id is null
        returning promoted_upload_id`,
      [file.id, request.id, upload.id],
    );
    promotedUploadId = updated.rows[0]?.promoted_upload_id ?? null;
    if (!promotedUploadId) {
      const current = await getDb().query<{ promoted_upload_id: string | null }>(
        `select promoted_upload_id
           from public.document_capture_files
          where id = $1::uuid and capture_request_id = $2::uuid
          limit 1`,
        [file.id, request.id],
      );
      promotedUploadId = current.rows[0]?.promoted_upload_id ?? null;
      if (!promotedUploadId) throw new Error('CAPTURE_FILE_PROMOTION_FAILED');
      if (promotedUploadId !== upload.id) await cleanupUnlinkedUpload();
      return { ...file, promotedUploadId };
    }
  } catch (error) {
    await cleanupUnlinkedUpload();
    throw error;
  }

  await deleteCaptureQuarantineFile(file.storageKey).catch((error) => {
    console.error('Promoted capture quarantine cleanup failed.', { requestId: request.id, fileId: file.id, error });
  });
  return { ...file, promotedUploadId };
}

async function promoteCleanFiles(request: CaptureRequestDetail): Promise<CaptureRequestFile[]> {
  const pending = request.files.filter((file) => file.securityStatus === 'pending');
  const clean = request.files.filter((file) => file.securityStatus === 'clean');
  if (pending.length) throw new Error('CAPTURE_FILE_SECURITY_PENDING');
  if (!clean.length) throw new Error('CAPTURE_CLEAN_FILE_REQUIRED');
  const promoted: CaptureRequestFile[] = [];
  for (const file of clean) promoted.push(await promoteCaptureFile(request, file));
  return promoted;
}

async function existingCanonicalOutput(request: CaptureRequestDetail): Promise<string | null> {
  if (!request.ownerUserId) return null;
  if (request.requestType === 'invoice') {
    const result = await getDb().query<{ id: string }>(
      `select id::text as id from public.asset_invoices
        where capture_request_id = $1::uuid
          and user_id = $2
          and asset_register_item_id = $3::uuid
        limit 1`,
      [request.id, request.ownerUserId, request.assetId],
    );
    return result.rows[0]?.id ?? null;
  }
  const result = await getDb().query<{ id: string }>(
    `select id::text as id from public.fuel_slips
      where capture_request_id = $1::uuid
        and user_id = $2
        and ($3::uuid is null or asset_register_item_id = $3::uuid)
        and ($4::uuid is null or storage_id = $4::uuid)
      limit 1`,
    [request.id, request.ownerUserId, request.assetId, request.fuelStorageId],
  );
  return result.rows[0]?.id ?? null;
}

async function createInvoiceOutput(
  request: CaptureRequestDetail,
  promotedFiles: CaptureRequestFile[],
): Promise<string> {
  if (!request.ownerUserId || !request.assetId) throw new Error('CAPTURE_TARGET_REQUIRED');
  const captured = normalizeInvoiceCapturePayload(
    request.capturedPayload,
    request.candidatePayload,
    request.requesterNote,
  );
  const primaryFile = promotedFiles[0];
  if (!primaryFile?.promotedUploadId) throw new Error('CAPTURE_FILE_PROMOTION_FAILED');
  const dealerUserId = request.submissionChannel === 'dealer_upload'
    ? text(request.submittedByUserId, 200)
    : '';
  const outputActor: MyInvoiceActorContext = dealerUserId
    ? {
        dealerUserId,
        dealerStaffId: text(request.candidatePayload.dealerStaffId, 200),
        displayName: request.sender.businessName || request.sender.name || 'Dealer',
        ownerApproved: request.events.some((event) => event.eventType === 'owner_approved'),
      }
    : { displayName: 'Aim4price assisted capture' };
  const document = await createInvoiceDocumentRecord({
    userId: request.ownerUserId,
    assetId: request.assetId,
    captureRequestId: request.id,
    uploadId: primaryFile.promotedUploadId,
    fileName: primaryFile.originalFileName,
    contentType: primaryFile.contentType,
    byteSize: primaryFile.byteSize,
    source: 'automatic',
    actor: outputActor,
  });
  const result = await createMyInvoice(request.ownerUserId, {
    captureRequestId: request.id,
    assetId: request.assetId,
    invoiceDocumentId: document.id,
    supplierName: captured.supplierName,
    invoiceNumber: captured.invoiceNumber,
    invoiceDate: captured.invoiceDate,
    subtotalExVat: captured.subtotalExVat,
    vatAmount: captured.vatAmount,
    totalIncVat: captured.totalIncVat,
    usageReading: captured.usageReading,
    usageMetric: captured.usageMetric,
    source: 'automatic',
    maintenanceWorkDone: captured.maintenanceWorkDone,
    partsSupplied: captured.partsSupplied,
    repairWorkDone: captured.repairWorkDone,
    notes: captured.notes,
  }, outputActor);
  if (!result.invoice) throw new Error('CAPTURE_INVOICE_CREATE_FAILED');
  return result.invoice.id;
}

async function assertFuelOperationalFields(
  request: CaptureRequestDetail,
  captured: NormalizedFuelCapture,
): Promise<void> {
  if (!request.assetId) return;
  if (!captured.operatorName) throw new Error('CAPTURE_FUEL_OPERATOR_REQUIRED');
  if (!captured.activityText) throw new Error('CAPTURE_FUEL_ACTIVITY_REQUIRED');
  if (!captured.workAreaText) throw new Error('CAPTURE_FUEL_WORK_AREA_REQUIRED');
  const assets = await listFuelAssetsForUser(request.ownerUserId ?? '');
  const asset = assets.find((entry) => entry.id === request.assetId);
  if (!asset) throw new Error('CAPTURE_ASSET_NOT_FOUND');
  if (asset.usageMetric === 'km' && captured.odometerReading === null) {
    throw new Error('CAPTURE_FUEL_USAGE_REQUIRED');
  }
  if (asset.usageMetric === 'hours' && captured.hourMeterReading === null) {
    throw new Error('CAPTURE_FUEL_USAGE_REQUIRED');
  }
  if (
    asset.usageMetric === 'both'
    && captured.odometerReading === null
    && captured.hourMeterReading === null
  ) {
    throw new Error('CAPTURE_FUEL_USAGE_REQUIRED');
  }
}

async function createFuelOutput(
  request: CaptureRequestDetail,
  promotedFiles: CaptureRequestFile[],
  actor: CaptureAdminActor,
): Promise<string> {
  if (!request.ownerUserId || (!request.assetId && !request.fuelStorageId)) {
    throw new Error('CAPTURE_TARGET_REQUIRED');
  }
  const captured = normalizeFuelCapturePayload(request.capturedPayload, request.candidatePayload);
  await assertFuelOperationalFields(request, captured);
  const primaryFile = promotedFiles[0];
  if (!primaryFile?.promotedUploadId) throw new Error('CAPTURE_FILE_PROMOTION_FAILED');
  const result = await saveFuelSlipTransaction(request.ownerUserId, {
    captureRequestId: request.id,
    mode: 'automatic',
    targetType: request.assetId ? 'asset' : 'storage_tank',
    targetId: request.assetId ?? request.fuelStorageId,
    assetId: request.assetId,
    storageId: request.fuelStorageId,
    uploadId: primaryFile.promotedUploadId,
    documentFileUrl: `/api/capture-requests/${encodeURIComponent(request.id)}/files/${encodeURIComponent(primaryFile.id)}`,
    originalFilename: primaryFile.originalFileName,
    contentType: primaryFile.contentType,
    byteSize: primaryFile.byteSize,
    supplierName: captured.supplierName,
    slipNumber: captured.slipNumber,
    documentDate: captured.documentDate,
    fuelType: captured.fuelType,
    litres: captured.litres,
    pricePerLitre: captured.pricePerLitre,
    totalAmount: captured.totalAmount,
    vatAmount: captured.vatAmount,
    odometerReading: captured.odometerReading,
    hourMeterReading: captured.hourMeterReading,
    operatorName: captured.operatorName,
    activityText: captured.activityText,
    workAreaText: captured.workAreaText,
    note: captured.note,
    assetFuelPercentBefore: captured.assetFuelPercentBefore,
    assetFuelPercentAfter: captured.assetFuelPercentAfter,
    extractionStatus: 'extracted',
    reviewRequired: false,
    auditActorUserId: actor.userId,
    auditActorName: actor.displayName,
    auditReason: `Aim4price assisted capture ${request.publicReference}`,
  });
  if (result.pendingReview) throw new Error('CAPTURE_FUEL_FIELDS_INCOMPLETE');
  return result.fuelSlip.id;
}

function validateCapturedDraft(request: CaptureRequestDetail): void {
  if (request.requestType === 'invoice') {
    normalizeInvoiceCapturePayload(request.capturedPayload, request.candidatePayload, request.requesterNote);
  } else {
    normalizeFuelCapturePayload(request.capturedPayload, request.candidatePayload);
  }
}

async function completeCanonicalOutput(
  request: CaptureRequestDetail,
  actor: CaptureAdminActor,
): Promise<CaptureFinalizationOutcome> {
  let outputId = await existingCanonicalOutput(request);
  if (!outputId) {
    const promotedFiles = await promoteCleanFiles(request);
    outputId = request.requestType === 'invoice'
      ? await createInvoiceOutput(request, promotedFiles)
      : await createFuelOutput(request, promotedFiles, actor);
  }
  const completed = await completeCaptureRequest(request.id, {
    outputType: request.requestType,
    outputId,
  }, actor);
  return { request: completed, outcome: 'completed', outputId };
}

export async function finalizeCaptureRequestForAdmin(
  requestId: string,
  actor: CaptureAdminActor,
): Promise<CaptureFinalizationOutcome> {
  return withFinalizationLock(requestId, async () => {
    const request = await getCaptureRequestDetail(requestId);
    if (!request) throw new Error('CAPTURE_REQUEST_NOT_FOUND');
    if (request.status === 'completed') {
      const outputId = request.finalInvoiceId ?? request.finalFuelSlipId ?? undefined;
      return { request, outcome: 'completed', outputId };
    }
    if (request.status === 'awaiting_owner') return { request, outcome: 'awaiting_owner' };
    if (request.status !== 'in_progress') throw new Error('CAPTURE_COMPLETION_STATUS_INVALID');
    if (request.assignedAdminUserId !== actor.userId) {
      throw new Error(request.assignedAdminUserId
        ? 'CAPTURE_CLAIMED_BY_ANOTHER_ADMIN'
        : 'CAPTURE_NOT_CLAIMED');
    }

    validateCapturedDraft(request);
    const ownerApproved = request.events.some((event) => event.eventType === 'owner_approved');
    if (EXTERNAL_CHANNELS.has(request.submissionChannel) && !ownerApproved) {
      const awaiting = await transitionCaptureRequest(request.id, 'awaiting_owner', {
        actor,
        note: 'Aim4price verified the submitted document.',
      });
      return { request: awaiting, outcome: 'awaiting_owner' };
    }
    return completeCanonicalOutput(request, actor);
  });
}

export async function approveCaptureRequestForOwner(
  requestId: string,
  ownerActor: CaptureEventActor & { actorType: 'owner'; userId: string },
): Promise<CaptureFinalizationOutcome> {
  return withFinalizationLock(requestId, async () => {
    let request = await getCaptureRequestDetail(requestId);
    if (!request || request.ownerUserId !== ownerActor.userId || !EXTERNAL_CHANNELS.has(request.submissionChannel)) {
      throw new Error('CAPTURE_REQUEST_NOT_FOUND');
    }
    if (request.status === 'completed') {
      const outputId = request.finalInvoiceId ?? request.finalFuelSlipId ?? undefined;
      return { request, outcome: 'completed', outputId };
    }
    if (request.status === 'awaiting_owner') {
      await transitionCaptureRequest(request.id, 'in_progress', {
        actor: ownerActor,
        note: 'Owner approved the verified document.',
      });
      request = await getCaptureRequestDetail(request.id);
      if (!request) throw new Error('CAPTURE_REQUEST_NOT_FOUND');
    }
    if (
      request.status !== 'in_progress'
      || !request.events.some((event) => event.eventType === 'owner_approved')
    ) {
      throw new Error('CAPTURE_OWNER_DECISION_INVALID');
    }
    if (!request.assignedAdminUserId || !request.assignedAdminDisplayName) {
      throw new Error('CAPTURE_ADMIN_REQUIRED');
    }
    validateCapturedDraft(request);
    return completeCanonicalOutput(request, {
      actorType: 'admin',
      userId: request.assignedAdminUserId,
      displayName: request.assignedAdminDisplayName,
    });
  });
}

export async function declineCaptureRequestForOwner(
  requestId: string,
  ownerActor: CaptureEventActor & { actorType: 'owner'; userId: string },
  reason?: string | null,
): Promise<CaptureRequest> {
  return withFinalizationLock(requestId, async () => {
    const request = await getCaptureRequestDetail(requestId);
    if (!request || request.ownerUserId !== ownerActor.userId || !EXTERNAL_CHANNELS.has(request.submissionChannel)) {
      throw new Error('CAPTURE_REQUEST_NOT_FOUND');
    }
    if (request.status === 'declined') return request;
    if (request.status !== 'awaiting_owner') throw new Error('CAPTURE_OWNER_DECISION_INVALID');
    return transitionCaptureRequest(request.id, 'declined', {
      actor: ownerActor,
      reason: text(reason, 1_000) || 'Owner declined the verified document.',
    });
  });
}
