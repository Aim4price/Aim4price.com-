import { ensureCaptureAllowanceSchema, reserveCaptureAllowance } from './capture-allowance';
import { randomBytes } from 'node:crypto';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { resolveAssetUsage } from './asset-usage';
import { getDb } from './db';

export const CAPTURE_REQUEST_TYPES = ['invoice', 'fuel_slip'] as const;
export type CaptureRequestType = (typeof CAPTURE_REQUEST_TYPES)[number];

export const CAPTURE_SUBMISSION_CHANNELS = [
  'owner_upload',
  'accountant_upload',
  'dealer_upload',
  'public_drop',
] as const;
export type CaptureSubmissionChannel = (typeof CAPTURE_SUBMISSION_CHANNELS)[number];

export const CAPTURE_REQUEST_STATUSES = [
  'submitted',
  'needs_matching',
  'in_progress',
  'needs_information',
  'awaiting_owner',
  'completed',
  'declined',
  'rejected',
  'cancelled',
] as const;
export type CaptureRequestStatus = (typeof CAPTURE_REQUEST_STATUSES)[number];

export const CAPTURE_ACTOR_TYPES = ['admin', 'owner', 'accountant', 'dealer', 'public', 'system'] as const;
export type CaptureActorType = (typeof CAPTURE_ACTOR_TYPES)[number];

export const CAPTURE_SENDER_TYPES = [
  'owner',
  'dealer',
  'workshop',
  'supplier',
  'accountant',
  'other',
] as const;
export type CaptureSenderType = (typeof CAPTURE_SENDER_TYPES)[number];

export const CAPTURE_FILE_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type CaptureFileContentType = (typeof CAPTURE_FILE_CONTENT_TYPES)[number];

export const CAPTURE_FILE_SECURITY_STATUSES = ['pending', 'clean', 'rejected'] as const;
export type CaptureFileSecurityStatus = (typeof CAPTURE_FILE_SECURITY_STATUSES)[number];

export const CAPTURE_EVENT_TYPES = [
  'created',
  'status_changed',
  'claimed',
  'draft_saved',
  'matched',
  'file_added',
  'file_security_updated',
  'information_requested',
  'output_linked',
  'owner_approved',
  'owner_declined',
  'note_added',
] as const;
export type CaptureEventType = (typeof CAPTURE_EVENT_TYPES)[number];

export const MAX_CAPTURE_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_CAPTURE_FILES_PER_REQUEST = 25;
export const CAPTURE_SLA_HOURS = 24;

export type CaptureEventActor = {
  actorType: CaptureActorType;
  userId?: string | null;
  displayName: string;
};

export type CaptureAdminActor = CaptureEventActor & {
  actorType: 'admin';
  userId: string;
};

export type CaptureSenderInput = {
  type?: CaptureSenderType | null;
  name?: string | null;
  businessName?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type CreateCaptureRequestInput = {
  requestType: CaptureRequestType;
  submissionChannel: CaptureSubmissionChannel;
  ownerUserId?: string | null;
  assetId?: string | null;
  fuelStorageId?: string | null;
  sender?: CaptureSenderInput | null;
  assetReference?: string | null;
  requesterNote?: string | null;
  candidatePayload?: Record<string, unknown> | null;
};

export type CaptureRequestFileInput = {
  storageKey: string;
  originalFileName: string;
  contentType: CaptureFileContentType;
  byteSize: number;
  sha256: string;
  pageOrder?: number;
  promotedUploadId?: string | null;
};

export type CaptureRequestDraftInput = {
  candidatePayload?: Record<string, unknown> | null;
  capturedPayload?: Record<string, unknown> | null;
  adminNote?: string | null;
  expectedVersion?: number | null;
};

export type CaptureRequestMatchInput = {
  ownerUserId: string;
  assetId?: string | null;
  fuelStorageId?: string | null;
  expectedVersion: number;
};

export type CaptureRequest = {
  id: string;
  publicReference: string;
  requestType: CaptureRequestType;
  submissionChannel: CaptureSubmissionChannel;
  status: CaptureRequestStatus;
  ownerUserId: string | null;
  assetId: string | null;
  fuelStorageId: string | null;
  invoiceDropCodeId: string | null;
  submittedByUserId: string | null;
  sender: {
    type: CaptureSenderType | null;
    name: string;
    businessName: string;
    email: string;
    phone: string;
  };
  assetReference: string;
  requesterNote: string;
  adminNote: string;
  needsInformationReason: string;
  candidatePayload: Record<string, unknown>;
  capturedPayload: Record<string, unknown>;
  assignedAdminUserId: string | null;
  assignedAdminDisplayName: string;
  claimedAtIso: string | null;
  finalInvoiceId: string | null;
  finalFuelSlipId: string | null;
  submittedAtIso: string;
  dueAtIso: string;
  updatedAtIso: string;
  resolvedAtIso: string | null;
  completedAtIso: string | null;
  version: number;
  fileCount: number;
  cleanFileCount: number;
};

export type CaptureRequestFile = {
  id: string;
  captureRequestId: string;
  storageKey: string;
  originalFileName: string;
  contentType: CaptureFileContentType;
  byteSize: number;
  sha256: string;
  pageOrder: number;
  securityStatus: CaptureFileSecurityStatus;
  securityReason: string;
  promotedUploadId: string | null;
  createdByActorType: CaptureActorType;
  createdByUserId: string | null;
  createdAtIso: string;
  securityCheckedAtIso: string | null;
  securityCheckedByAdminUserId: string | null;
};

export type CaptureRequestEvent = {
  id: string;
  captureRequestId: string;
  eventType: CaptureEventType;
  fromStatus: CaptureRequestStatus | null;
  toStatus: CaptureRequestStatus | null;
  actor: {
    actorType: CaptureActorType;
    userId: string | null;
    displayName: string;
  };
  note: string;
  metadata: Record<string, unknown>;
  createdAtIso: string;
};

export type CaptureRequestDetail = CaptureRequest & {
  files: CaptureRequestFile[];
  events: CaptureRequestEvent[];
};

export type CaptureRequestAssetUsageUpdateResult = {
  request: CaptureRequest;
  updated: boolean;
  metric: 'hours' | 'km';
  previousReading: number | null;
  newReading: number;
};

export type CaptureRequestListFilters = {
  statuses?: CaptureRequestStatus[];
  requestTypes?: CaptureRequestType[];
  submissionChannels?: CaptureSubmissionChannel[];
  ownerUserId?: string | null;
  submittedByUserId?: string | null;
  assetId?: string | null;
  assignedAdminUserId?: string | null;
  unassignedOnly?: boolean;
  completedAfter?: Date | string | null;
  completedBefore?: Date | string | null;
  dueBeforeExclusive?: boolean;
  dueBefore?: Date | string | null;
  dueAfter?: Date | string | null;
  submittedAfter?: Date | string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
};

export type CaptureQueueCounts = {
  totalOpen: number;
  unassigned: number;
  overdue: number;
  dueWithin24Hours: number;
  needsMatching: number;
  needsInformation: number;
  awaitingOwner: number;
  completedToday: number;
};

type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
};

type CaptureRequestRow = QueryResultRow & {
  id: string;
  public_reference: string;
  request_type: string;
  submission_channel: string;
  status: string;
  owner_user_id: string | null;
  asset_register_item_id: string | null;
  fuel_storage_id: string | null;
  invoice_drop_code_id: string | null;
  submitted_by_user_id: string | null;
  sender_type: string | null;
  sender_name: string | null;
  sender_business_name: string | null;
  sender_email: string | null;
  sender_phone: string | null;
  asset_reference: string | null;
  requester_note: string | null;
  admin_note: string | null;
  needs_information_reason: string | null;
  candidate_payload: unknown;
  captured_payload: unknown;
  assigned_admin_user_id: string | null;
  assigned_admin_display_name: string | null;
  claimed_at: Date | string | null;
  final_invoice_id: string | null;
  final_fuel_slip_id: string | null;
  submitted_at: Date | string;
  due_at: Date | string;
  updated_at: Date | string;
  resolved_at: Date | string | null;
  completed_at: Date | string | null;
  version: number | string;
  file_count?: number | string | null;
  clean_file_count?: number | string | null;
};

type CaptureFileRow = QueryResultRow & {
  id: string;
  capture_request_id: string;
  storage_key: string;
  original_file_name: string;
  content_type: string;
  byte_size: number | string;
  sha256: string;
  page_order: number | string;
  security_status: string;
  security_reason: string | null;
  promoted_upload_id: string | null;
  created_by_actor_type: string;
  created_by_user_id: string | null;
  created_at: Date | string;
  security_checked_at: Date | string | null;
  security_checked_by_admin_user_id: string | null;
};

type CaptureEventRow = QueryResultRow & {
  id: string;
  capture_request_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_type: string;
  actor_user_id: string | null;
  actor_display_name: string;
  note: string | null;
  metadata: unknown;
  created_at: Date | string;
};

type CaptureQueueCountRow = QueryResultRow & {
  total_open: number | string;
  unassigned: number | string;
  overdue: number | string;
  due_within_24_hours: number | string;
  needs_matching: number | string;
  needs_information: number | string;
  awaiting_owner: number | string;
  completed_today: number | string;
};

type DropCodeRow = QueryResultRow & {
  id: string;
  owner_user_id: string;
  asset_register_item_id: string | null;
  code_hash?: string | null;
  code_last_four: string;
  created_at: Date | string;
};

type CaptureUsageAssetRow = QueryResultRow & {
  kind: unknown;
  hours: string | number | null;
  life_worked_percent: string | number | null;
  specs_json: unknown;
  valuation_run_id: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CAPTURE_STORAGE_KEY_PATTERN = /^v1\/capture-quarantine\/[0-9a-f]{2}\/[a-z0-9][a-z0-9/_-]{15,480}$/;
const TERMINAL_STATUSES = new Set<CaptureRequestStatus>([
  'completed',
  'declined',
  'rejected',
  'cancelled',
]);

const ALLOWED_TRANSITIONS: Record<CaptureRequestStatus, readonly CaptureRequestStatus[]> = {
  submitted: ['needs_matching', 'in_progress', 'needs_information', 'rejected', 'cancelled'],
  needs_matching: ['submitted', 'in_progress', 'needs_information', 'rejected', 'cancelled'],
  in_progress: ['submitted', 'needs_matching', 'needs_information', 'awaiting_owner', 'rejected', 'cancelled'],
  needs_information: ['submitted', 'needs_matching', 'in_progress', 'rejected', 'cancelled'],
  awaiting_owner: ['in_progress', 'declined', 'rejected', 'cancelled'],
  completed: [],
  declined: [],
  rejected: [],
  cancelled: [],
};

const REQUEST_SELECT = `
  select
    request.*,
    coalesce(file_stats.file_count, 0)::integer as file_count,
    coalesce(file_stats.clean_file_count, 0)::integer as clean_file_count
  from public.document_capture_requests request
  left join lateral (
    select
      count(*)::integer as file_count,
      count(*) filter (where file.security_status = 'clean')::integer as clean_file_count
    from public.document_capture_files file
    where file.capture_request_id = request.id
  ) file_stats on true
`;

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanMultilineText(value: unknown, maxLength: number): string {
  const cleaned = String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, maxLength);
  return redactSensitivePaymentText(cleaned);
}

function asIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date(0).toISOString();
}

function nullableIso(value: Date | string | null): string | null {
  return value === null ? null : asIso(value);
}

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asUuid(value: unknown, errorCode: string): string {
  const normalized = cleanText(value, 80);
  if (!UUID_PATTERN.test(normalized)) throw new Error(errorCode);
  return normalized;
}

function optionalUuid(value: unknown, errorCode: string): string | null {
  const normalized = cleanText(value, 80);
  return normalized ? asUuid(normalized, errorCode) : null;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  errorCode: string,
): T {
  const normalized = cleanText(value, 80) as T;
  if (!allowed.includes(normalized)) throw new Error(errorCode);
  return normalized;
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function redactSensitivePaymentText(value: string): string {
  return value.replace(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g, (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 13 && digits.length <= 19
      ? `************${digits.slice(-4)}`
      : match;
  });
}

export function redactCapturePayload(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitivePaymentText(value);
  if (Array.isArray(value)) return value.slice(0, 500).map(redactCapturePayload);
  if (!value || typeof value !== 'object') return value;

  const output: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, 500)) {
    const key = cleanText(rawKey, 100);
    if (!key || key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    const paymentKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    if (/^(cvv|cvc|card_verification_value|card_security_code|full_card_number|pan)$/.test(paymentKey)) {
      output[key] = '[REDACTED]';
      continue;
    }

    // This validated UUID is the retry key, not payment data. Masking its digits
    // changes the key and can create a second capture for the same submission.
    if (key === 'sharedSaveId' && typeof rawValue === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawValue)) {
      output[key] = rawValue;
      continue;
    }
    output[key] = redactCapturePayload(rawValue);
  }
  return output;
}

function normalizePayload(value: unknown): Record<string, unknown> {
  const redacted = jsonObject(redactCapturePayload(value));
  const serialized = JSON.stringify(redacted);
  if (Buffer.byteLength(serialized, 'utf8') > 100_000) throw new Error('CAPTURE_PAYLOAD_TOO_LARGE');
  return JSON.parse(serialized) as Record<string, unknown>;
}

function normalizeActor(actor: CaptureEventActor): Required<CaptureEventActor> {
  const actorType = enumValue(actor?.actorType, CAPTURE_ACTOR_TYPES, 'CAPTURE_ACTOR_INVALID');
  const userId = cleanText(actor?.userId, 200);
  const displayName = cleanText(actor?.displayName, 180);
  if (!displayName) throw new Error('CAPTURE_ACTOR_INVALID');
  if (['admin', 'owner', 'accountant', 'dealer'].includes(actorType) && !userId) {
    throw new Error('CAPTURE_ACTOR_INVALID');
  }
  return { actorType, userId, displayName };
}

function normalizeAdminActor(actor: CaptureAdminActor): Required<CaptureAdminActor> {
  const normalized = normalizeActor(actor);
  if (normalized.actorType !== 'admin' || !normalized.userId) throw new Error('CAPTURE_ADMIN_REQUIRED');
  return normalized as Required<CaptureAdminActor>;
}

function mapRequestRow(row: CaptureRequestRow): CaptureRequest {
  return {
    id: String(row.id),
    publicReference: cleanText(row.public_reference, 40),
    requestType: enumValue(row.request_type, CAPTURE_REQUEST_TYPES, 'CAPTURE_TYPE_INVALID'),
    submissionChannel: enumValue(row.submission_channel, CAPTURE_SUBMISSION_CHANNELS, 'CAPTURE_CHANNEL_INVALID'),
    status: enumValue(row.status, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID'),
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
    assetId: row.asset_register_item_id ? String(row.asset_register_item_id) : null,
    fuelStorageId: row.fuel_storage_id ? String(row.fuel_storage_id) : null,
    invoiceDropCodeId: row.invoice_drop_code_id ? String(row.invoice_drop_code_id) : null,
    submittedByUserId: row.submitted_by_user_id ? String(row.submitted_by_user_id) : null,
    sender: {
      type: row.sender_type
        ? enumValue(row.sender_type, CAPTURE_SENDER_TYPES, 'CAPTURE_SENDER_TYPE_INVALID')
        : null,
      name: cleanText(row.sender_name, 180),
      businessName: cleanText(row.sender_business_name, 180),
      email: cleanText(row.sender_email, 254),
      phone: cleanText(row.sender_phone, 40),
    },
    assetReference: cleanText(row.asset_reference, 180),
    requesterNote: cleanMultilineText(row.requester_note, 5_000),
    adminNote: cleanMultilineText(row.admin_note, 10_000),
    needsInformationReason: cleanMultilineText(row.needs_information_reason, 2_000),
    candidatePayload: jsonObject(row.candidate_payload),
    capturedPayload: jsonObject(row.captured_payload),
    assignedAdminUserId: row.assigned_admin_user_id ? String(row.assigned_admin_user_id) : null,
    assignedAdminDisplayName: cleanText(row.assigned_admin_display_name, 180),
    claimedAtIso: nullableIso(row.claimed_at),
    finalInvoiceId: row.final_invoice_id ? String(row.final_invoice_id) : null,
    finalFuelSlipId: row.final_fuel_slip_id ? String(row.final_fuel_slip_id) : null,
    submittedAtIso: asIso(row.submitted_at),
    dueAtIso: asIso(row.due_at),
    updatedAtIso: asIso(row.updated_at),
    resolvedAtIso: nullableIso(row.resolved_at),
    completedAtIso: nullableIso(row.completed_at),
    version: Math.max(1, Math.trunc(asNumber(row.version))),
    fileCount: Math.max(0, Math.trunc(asNumber(row.file_count))),
    cleanFileCount: Math.max(0, Math.trunc(asNumber(row.clean_file_count))),
  };
}

function mapFileRow(row: CaptureFileRow): CaptureRequestFile {
  return {
    id: String(row.id),
    captureRequestId: String(row.capture_request_id),
    storageKey: String(row.storage_key),
    originalFileName: cleanText(row.original_file_name, 240) || 'document',
    contentType: enumValue(row.content_type, CAPTURE_FILE_CONTENT_TYPES, 'CAPTURE_FILE_TYPE_INVALID'),
    byteSize: Math.max(0, Math.trunc(asNumber(row.byte_size))),
    sha256: String(row.sha256),
    pageOrder: Math.max(0, Math.trunc(asNumber(row.page_order))),
    securityStatus: enumValue(row.security_status, CAPTURE_FILE_SECURITY_STATUSES, 'CAPTURE_FILE_SECURITY_INVALID'),
    securityReason: cleanMultilineText(row.security_reason, 2_000),
    promotedUploadId: row.promoted_upload_id ? String(row.promoted_upload_id) : null,
    createdByActorType: enumValue(row.created_by_actor_type, CAPTURE_ACTOR_TYPES, 'CAPTURE_ACTOR_INVALID'),
    createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : null,
    createdAtIso: asIso(row.created_at),
    securityCheckedAtIso: nullableIso(row.security_checked_at),
    securityCheckedByAdminUserId: row.security_checked_by_admin_user_id
      ? String(row.security_checked_by_admin_user_id)
      : null,
  };
}

function mapEventRow(row: CaptureEventRow): CaptureRequestEvent {
  return {
    id: String(row.id),
    captureRequestId: String(row.capture_request_id),
    eventType: enumValue(row.event_type, CAPTURE_EVENT_TYPES, 'CAPTURE_EVENT_TYPE_INVALID'),
    fromStatus: row.from_status
      ? enumValue(row.from_status, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID')
      : null,
    toStatus: row.to_status
      ? enumValue(row.to_status, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID')
      : null,
    actor: {
      actorType: enumValue(row.actor_type, CAPTURE_ACTOR_TYPES, 'CAPTURE_ACTOR_INVALID'),
      userId: row.actor_user_id ? String(row.actor_user_id) : null,
      displayName: cleanText(row.actor_display_name, 180),
    },
    note: cleanMultilineText(row.note, 2_000),
    metadata: jsonObject(row.metadata),
    createdAtIso: asIso(row.created_at),
  };
}

async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getDb().connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function insertEvent(
  client: Queryable,
  input: {
    requestId: string;
    eventType: CaptureEventType;
    actor: CaptureEventActor;
    fromStatus?: CaptureRequestStatus | null;
    toStatus?: CaptureRequestStatus | null;
    note?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  const actor = normalizeActor(input.actor);
  await client.query(
    `
      insert into public.document_capture_events (
        capture_request_id,
        event_type,
        from_status,
        to_status,
        actor_type,
        actor_user_id,
        actor_display_name,
        note,
        metadata
      ) values ($1::uuid, $2, $3, $4, $5, nullif($6, ''), $7, nullif($8, ''), $9::jsonb)
    `,
    [
      input.requestId,
      input.eventType,
      input.fromStatus ?? null,
      input.toStatus ?? null,
      actor.actorType,
      actor.userId,
      actor.displayName,
      cleanMultilineText(input.note, 2_000),
      JSON.stringify(normalizePayload(input.metadata)),
    ],
  );
}

async function getLockedRequest(client: Queryable, requestId: string): Promise<CaptureRequestRow> {
  const id = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const result = await client.query<CaptureRequestRow>(
    `select request.*, 0::integer as file_count, 0::integer as clean_file_count
       from public.document_capture_requests request
      where request.id = $1::uuid
      for update`,
    [id],
  );
  if (!result.rows[0]) throw new Error('CAPTURE_REQUEST_NOT_FOUND');
  return result.rows[0];
}

async function getRequestWithCounts(client: Queryable, requestId: string): Promise<CaptureRequest> {
  const result = await client.query<CaptureRequestRow>(
    `${REQUEST_SELECT} where request.id = $1::uuid limit 1`,
    [requestId],
  );
  if (!result.rows[0]) throw new Error('CAPTURE_REQUEST_NOT_FOUND');
  return mapRequestRow(result.rows[0]);
}

function generateReference(requestType: CaptureRequestType): string {
  const prefix = requestType === 'invoice' ? 'INV' : 'FSL';
  let suffix = '';
  const bytes = randomBytes(10);
  for (let index = 0; index < 10; index += 1) {
    suffix += REFERENCE_ALPHABET[bytes[index] % REFERENCE_ALPHABET.length];
  }
  return `A4P-${prefix}-${suffix}`;
}

function normalizeSender(sender: CaptureSenderInput | null | undefined) {
  const type = sender?.type
    ? enumValue(sender.type, CAPTURE_SENDER_TYPES, 'CAPTURE_SENDER_TYPE_INVALID')
    : null;
  const email = cleanText(sender?.email, 254).toLowerCase();
  if (email && (!email.includes('@') || email.startsWith('@') || email.endsWith('@'))) {
    throw new Error('CAPTURE_SENDER_EMAIL_INVALID');
  }
  return {
    type,
    name: cleanText(sender?.name, 180),
    businessName: cleanText(sender?.businessName, 180),
    email,
    phone: cleanText(sender?.phone, 40),
  };
}

function assertCreationActor(
  input: { submissionChannel: CaptureSubmissionChannel; ownerUserId: string | null },
  actor: Required<CaptureEventActor>,
): void {
  if (actor.actorType === 'admin' && actor.userId) return;
  if (input.submissionChannel === 'owner_upload') {
    if (actor.actorType !== 'owner' || !actor.userId || actor.userId !== input.ownerUserId) {
      throw new Error('CAPTURE_OWNER_SCOPE_FORBIDDEN');
    }
    return;
  }
  if (input.submissionChannel === 'accountant_upload') {
    if (actor.actorType !== 'accountant' || !actor.userId || !input.ownerUserId) {
      throw new Error('CAPTURE_ACCOUNTANT_REQUIRED');
    }
    return;
  }
  if (input.submissionChannel === 'dealer_upload') {
    if (actor.actorType !== 'dealer' || !actor.userId) throw new Error('CAPTURE_DEALER_REQUIRED');
    return;
  }
  throw new Error('CAPTURE_CHANNEL_INVALID');
}

async function assertTargetOwnership(
  client: Queryable,
  input: { ownerUserId: string; assetId: string | null; fuelStorageId: string | null },
): Promise<void> {
  if (input.assetId) {
    const asset = await client.query(
      `select 1 from public.asset_register_items where id = $1::uuid and user_id = $2 limit 1`,
      [input.assetId, input.ownerUserId],
    );
    if (!asset.rows[0]) throw new Error('CAPTURE_ASSET_NOT_FOUND');
  }
  if (input.fuelStorageId) {
    const storage = await client.query(
      `select 1 from public.fuel_storage_units where id = $1::uuid and user_id = $2 limit 1`,
      [input.fuelStorageId, input.ownerUserId],
    );
    if (!storage.rows[0]) throw new Error('CAPTURE_FUEL_STORAGE_NOT_FOUND');
  }
}

export async function createCaptureRequest(
  input: CreateCaptureRequestInput,
  eventActor: CaptureEventActor,
  transaction?: { before: (client: PoolClient) => Promise<void>; after: (client: PoolClient, request: CaptureRequest) => Promise<void> },
): Promise<CaptureRequest> {
  const requestType = enumValue(input.requestType, CAPTURE_REQUEST_TYPES, 'CAPTURE_TYPE_INVALID');
  const submissionChannel = enumValue(
    input.submissionChannel,
    CAPTURE_SUBMISSION_CHANNELS,
    'CAPTURE_CHANNEL_INVALID',
  );
  if (submissionChannel === 'public_drop') throw new Error('CAPTURE_CHANNEL_INVALID');
  const actor = normalizeActor(eventActor);
  const ownerUserId = cleanText(input.ownerUserId, 200) || null;
  const assetId = optionalUuid(input.assetId, 'CAPTURE_ASSET_INVALID');
  const fuelStorageId = optionalUuid(input.fuelStorageId, 'CAPTURE_FUEL_STORAGE_INVALID');
  const sender = normalizeSender(input.sender);
  const assetReference = cleanText(input.assetReference, 180);
  const requesterNote = cleanMultilineText(input.requesterNote, 5_000);
  const candidatePayload = normalizePayload(input.candidatePayload);

  assertCreationActor({ submissionChannel, ownerUserId }, actor);

  if (requestType === 'invoice' && fuelStorageId) throw new Error('CAPTURE_TARGET_INVALID');
  if (requestType === 'fuel_slip' && Boolean(assetId) === Boolean(fuelStorageId)) {
    throw new Error('CAPTURE_TARGET_INVALID');
  }
  if (requestType === 'fuel_slip' && !ownerUserId) throw new Error('CAPTURE_OWNER_REQUIRED');
  if (requestType === 'invoice' && (!ownerUserId || !assetId)) {
    throw new Error('CAPTURE_ASSET_REQUIRED');
  }
  if ((assetId || fuelStorageId) && !ownerUserId) throw new Error('CAPTURE_OWNER_REQUIRED');

  await ensureCaptureAllowanceSchema();
  const publicReference = generateReference(requestType);
  const initialStatus: CaptureRequestStatus = 'submitted';

  return withTransaction(async (client) => {
    await transaction?.before(client);
    if (ownerUserId) {
      await assertTargetOwnership(client, { ownerUserId, assetId, fuelStorageId });
    }

    const result = await client.query<CaptureRequestRow>(
      `
        insert into public.document_capture_requests (
          public_reference,
          request_type,
          submission_channel,
          status,
          owner_user_id,
          asset_register_item_id,
          fuel_storage_id,
          submitted_by_user_id,
          sender_type,
          sender_name,
          sender_business_name,
          sender_email,
          sender_phone,
          asset_reference,
          requester_note,
          candidate_payload,
          submitted_at,
          due_at,
          updated_at
        ) values (
          $1, $2, $3, $4, nullif($5, ''), $6::uuid, $7::uuid,
          nullif($8, ''), $9, nullif($10, ''), nullif($11, ''), nullif($12, ''),
          nullif($13, ''), nullif($14, ''), $15, $16::jsonb,
          now(), now() + interval '24 hours', now()
        )
        returning *, 0::integer as file_count, 0::integer as clean_file_count
      `,
      [
        publicReference,
        requestType,
        submissionChannel,
        initialStatus,
        ownerUserId ?? '',
        assetId,
        fuelStorageId,
        actor.userId,
        sender.type,
        sender.name,
        sender.businessName,
        sender.email,
        sender.phone,
        assetReference,
        requesterNote,
        JSON.stringify(candidatePayload),
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('CAPTURE_CREATE_FAILED');
    if (ownerUserId && actor.actorType !== 'admin') {
      await reserveCaptureAllowance(client, ownerUserId, requestType, String(row.id));
    }

    await insertEvent(client, {
      requestId: row.id,
      eventType: 'created',
      actor,
      toStatus: initialStatus,
      metadata: { requestType, submissionChannel, dueInHours: CAPTURE_SLA_HOURS },
    });
    const request = mapRequestRow(row);
    await transaction?.after(client,request);
    return request;
  });
}

function normalizeCaptureFileInput(input: CaptureRequestFileInput) {
  const storageKey = cleanText(input.storageKey, 500);
  if (!CAPTURE_STORAGE_KEY_PATTERN.test(storageKey) || storageKey.includes('..')) {
    throw new Error('CAPTURE_FILE_STORAGE_KEY_INVALID');
  }
  const originalFileName = cleanText(input.originalFileName, 240);
  if (!originalFileName || /[\\/]/.test(originalFileName)) {
    throw new Error('CAPTURE_FILE_NAME_INVALID');
  }
  const contentType = enumValue(
    input.contentType,
    CAPTURE_FILE_CONTENT_TYPES,
    'CAPTURE_FILE_TYPE_INVALID',
  );
  const byteSize = Number(input.byteSize);
  if (!Number.isSafeInteger(byteSize) || byteSize <= 0 || byteSize > MAX_CAPTURE_FILE_BYTES) {
    throw new Error('CAPTURE_FILE_SIZE_INVALID');
  }
  const sha256 = cleanText(input.sha256, 64).toLowerCase();
  if (!SHA256_PATTERN.test(sha256)) throw new Error('CAPTURE_FILE_HASH_INVALID');
  const pageOrder = input.pageOrder === undefined ? 0 : Number(input.pageOrder);
  if (!Number.isSafeInteger(pageOrder) || pageOrder < 0 || pageOrder >= 100) {
    throw new Error('CAPTURE_FILE_PAGE_INVALID');
  }
  const promotedUploadId = cleanText(input.promotedUploadId, 200) || null;
  return {
    storageKey,
    originalFileName,
    contentType,
    byteSize,
    sha256,
    pageOrder,
    promotedUploadId,
  };
}

export async function addCaptureRequestFile(
  requestId: string,
  input: CaptureRequestFileInput,
  eventActor: CaptureEventActor,
  writer?: PoolClient,
): Promise<CaptureRequestFile> {
  const id = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const file = normalizeCaptureFileInput(input);
  const actor = normalizeActor(eventActor);

  const save = async (client: PoolClient) => {
    await assertCaptureRequestNotFinalizing(client, id);
    const requestRow = await getLockedRequest(client, id);
    const status = enumValue(requestRow.status, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID');
    if (TERMINAL_STATUSES.has(status)) throw new Error('CAPTURE_REQUEST_CLOSED');

    const actorIsSubmitter = (
      (requestRow.submission_channel === 'owner_upload'
        && actor.actorType === 'owner'
        && actor.userId === requestRow.owner_user_id)
      || (requestRow.submission_channel === 'accountant_upload'
        && actor.actorType === 'accountant'
        && actor.userId === requestRow.submitted_by_user_id)
      || (requestRow.submission_channel === 'dealer_upload'
        && actor.actorType === 'dealer'
        && actor.userId === requestRow.submitted_by_user_id)
      || actor.actorType === 'admin'
      || actor.actorType === 'system'
    );
    if (!actorIsSubmitter) throw new Error('CAPTURE_FILE_SCOPE_FORBIDDEN');

    const countResult = await client.query<{ count: string } & QueryResultRow>(
      `select count(*)::text as count from public.document_capture_files where capture_request_id = $1::uuid`,
      [id],
    );
    if (asNumber(countResult.rows[0]?.count) >= MAX_CAPTURE_FILES_PER_REQUEST) {
      throw new Error('CAPTURE_FILE_LIMIT_REACHED');
    }

    const existing = await client.query<CaptureFileRow>(
      `select * from public.document_capture_files
        where capture_request_id = $1::uuid and sha256 = $2
        limit 1`,
      [id, file.sha256],
    );
    if (existing.rows[0]) return mapFileRow(existing.rows[0]);

    const result = await client.query<CaptureFileRow>(
      `
        insert into public.document_capture_files (
          capture_request_id,
          storage_key,
          original_file_name,
          content_type,
          byte_size,
          sha256,
          page_order,
          promoted_upload_id,
          created_by_actor_type,
          created_by_user_id
        ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, nullif($10, ''))
        returning *
      `,
      [
        id,
        file.storageKey,
        file.originalFileName,
        file.contentType,
        file.byteSize,
        file.sha256,
        file.pageOrder,
        file.promotedUploadId,
        actor.actorType,
        actor.userId,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('CAPTURE_FILE_CREATE_FAILED');

    await insertEvent(client, {
      requestId: id,
      eventType: 'file_added',
      actor,
      fromStatus: status,
      toStatus: status,
      metadata: {
        fileId: row.id,
        contentType: row.content_type,
        byteSize: asNumber(row.byte_size),
        pageOrder: asNumber(row.page_order),
      },
    });
    return mapFileRow(row);
  };
  return writer ? save(writer) : withTransaction(save);
}

export async function listCaptureRequestFiles(requestId: string): Promise<CaptureRequestFile[]> {
  const id = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const result = await getDb().query<CaptureFileRow>(
    `select * from public.document_capture_files
      where capture_request_id = $1::uuid
      order by page_order asc, created_at asc, id asc`,
    [id],
  );
  return result.rows.map(mapFileRow);
}

export async function getCaptureRequestFile(
  requestId: string,
  fileId: string,
): Promise<CaptureRequestFile | null> {
  const requestUuid = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const fileUuid = asUuid(fileId, 'CAPTURE_FILE_NOT_FOUND');
  const result = await getDb().query<CaptureFileRow>(
    `select * from public.document_capture_files
      where id = $1::uuid and capture_request_id = $2::uuid
      limit 1`,
    [fileUuid, requestUuid],
  );
  return result.rows[0] ? mapFileRow(result.rows[0]) : null;
}

export async function isProtectedCaptureUpload(uploadId: string): Promise<boolean> {
  const normalizedUploadId = cleanText(uploadId, 500);
  if (!normalizedUploadId) return false;

  const table = await getDb().query<{ table_name: string | null }>(
    `select to_regclass('public.document_capture_files')::text as table_name`,
  );
  if (!table.rows[0]?.table_name) return false;

  const result = await getDb().query<{ protected: boolean }>(
    `select exists (
       select 1
       from public.document_capture_files
       where promoted_upload_id = $1
     ) as protected`,
    [normalizedUploadId],
  );
  return Boolean(result.rows[0]?.protected);
}

export async function setCaptureRequestFileSecurityStatus(
  requestId: string,
  fileId: string,
  input: { status: Exclude<CaptureFileSecurityStatus, 'pending'>; reason?: string | null },
  adminActor: CaptureAdminActor,
): Promise<CaptureRequestFile> {
  const requestUuid = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const fileUuid = asUuid(fileId, 'CAPTURE_FILE_NOT_FOUND');
  const actor = normalizeAdminActor(adminActor);
  const status = enumValue(input.status, ['clean', 'rejected'] as const, 'CAPTURE_FILE_SECURITY_INVALID');
  const reason = cleanMultilineText(input.reason, 2_000);
  if (status === 'rejected' && !reason) throw new Error('CAPTURE_FILE_REJECTION_REASON_REQUIRED');

  return withTransaction(async (client) => {
    await assertCaptureRequestNotFinalizing(client, requestUuid);
    const request = await getLockedRequest(client, requestUuid);
    const requestStatus = enumValue(request.status, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID');
    if (TERMINAL_STATUSES.has(requestStatus)) throw new Error('CAPTURE_REQUEST_CLOSED');

    const existing = await client.query<CaptureFileRow>(
      `select * from public.document_capture_files
        where id = $1::uuid and capture_request_id = $2::uuid
        for update`,
      [fileUuid, requestUuid],
    );
    if (!existing.rows[0]) throw new Error('CAPTURE_FILE_NOT_FOUND');
    if (existing.rows[0].security_status === status && cleanMultilineText(existing.rows[0].security_reason, 2_000) === reason) {
      return mapFileRow(existing.rows[0]);
    }

    const updated = await client.query<CaptureFileRow>(
      `update public.document_capture_files
          set security_status = $3,
              security_reason = nullif($4, ''),
              security_checked_at = now(),
              security_checked_by_admin_user_id = $5
        where id = $1::uuid and capture_request_id = $2::uuid
        returning *`,
      [fileUuid, requestUuid, status, reason, actor.userId],
    );
    const row = updated.rows[0];
    if (!row) throw new Error('CAPTURE_FILE_NOT_FOUND');
    await insertEvent(client, {
      requestId: requestUuid,
      eventType: 'file_security_updated',
      actor,
      fromStatus: requestStatus,
      toStatus: requestStatus,
      note: reason,
      metadata: { fileId: fileUuid, securityStatus: status },
    });
    return mapFileRow(row);
  });
}

export async function listCaptureRequestEvents(requestId: string): Promise<CaptureRequestEvent[]> {
  const id = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const result = await getDb().query<CaptureEventRow>(
    `select * from public.document_capture_events
      where capture_request_id = $1::uuid
      order by created_at asc, id asc`,
    [id],
  );
  return result.rows.map(mapEventRow);
}

export async function getCaptureRequestDetail(
  requestId: string,
): Promise<CaptureRequestDetail | null> {
  const normalized = cleanText(requestId, 80);
  if (!UUID_PATTERN.test(normalized)) return null;
  const requestResult = await getDb().query<CaptureRequestRow>(
    `${REQUEST_SELECT} where request.id = $1::uuid limit 1`,
    [normalized],
  );
  if (!requestResult.rows[0]) return null;
  const [files, events] = await Promise.all([
    listCaptureRequestFiles(normalized),
    listCaptureRequestEvents(normalized),
  ]);
  return { ...mapRequestRow(requestResult.rows[0]), files, events };
}

function normalizeFilterDate(value: Date | string | null | undefined, errorCode: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(errorCode);
  return parsed.toISOString();
}

function normalizedEnumFilter<T extends string>(
  values: readonly unknown[] | undefined,
  allowed: readonly T[],
  errorCode: string,
): T[] {
  if (!values?.length) return [];
  return [...new Set(values.map((value) => enumValue(value, allowed, errorCode)))];
}

function buildCaptureListWhere(filters: CaptureRequestListFilters) {
  const clauses: string[] = ['true'];
  const values: unknown[] = [];
  const add = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  const statuses = normalizedEnumFilter(filters.statuses, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID');
  const types = normalizedEnumFilter(filters.requestTypes, CAPTURE_REQUEST_TYPES, 'CAPTURE_TYPE_INVALID');
  const channels = normalizedEnumFilter(
    filters.submissionChannels,
    CAPTURE_SUBMISSION_CHANNELS,
    'CAPTURE_CHANNEL_INVALID',
  );

  if (statuses.length) clauses.push(`request.status = any(${add(statuses)}::text[])`);
  if (types.length) clauses.push(`request.request_type = any(${add(types)}::text[])`);
  if (channels.length) clauses.push(`request.submission_channel = any(${add(channels)}::text[])`);
  const ownerUserId = cleanText(filters.ownerUserId, 200);
  if (ownerUserId) clauses.push(`request.owner_user_id = ${add(ownerUserId)}`);
  const submittedByUserId = cleanText(filters.submittedByUserId, 200);
  if (submittedByUserId) clauses.push(`request.submitted_by_user_id = ${add(submittedByUserId)}`);
  const assetId = filters.assetId ? asUuid(filters.assetId, 'CAPTURE_ASSET_INVALID') : '';
  if (assetId) clauses.push(`request.asset_register_item_id = ${add(assetId)}::uuid`);
  const adminUserId = cleanText(filters.assignedAdminUserId, 200);
  if (adminUserId) clauses.push(`request.assigned_admin_user_id = ${add(adminUserId)}`);
  if (filters.unassignedOnly) clauses.push('request.assigned_admin_user_id is null');
  const completedAfter = normalizeFilterDate(filters.completedAfter, 'CAPTURE_FILTER_DATE_INVALID');
  const completedBefore = normalizeFilterDate(filters.completedBefore, 'CAPTURE_FILTER_DATE_INVALID');
  if (completedAfter) clauses.push(`request.completed_at >= ${add(completedAfter)}::timestamptz`);
  if (completedBefore) clauses.push(`request.completed_at < ${add(completedBefore)}::timestamptz`);
  const dueBefore = normalizeFilterDate(filters.dueBefore, 'CAPTURE_FILTER_DATE_INVALID');
  const dueAfter = normalizeFilterDate(filters.dueAfter, 'CAPTURE_FILTER_DATE_INVALID');
  const submittedAfter = normalizeFilterDate(filters.submittedAfter, 'CAPTURE_FILTER_DATE_INVALID');
  if (dueBefore) clauses.push(`request.due_at ${filters.dueBeforeExclusive ? '<' : '<='} ${add(dueBefore)}::timestamptz`);
  if (dueAfter) clauses.push(`request.due_at >= ${add(dueAfter)}::timestamptz`);
  if (submittedAfter) clauses.push(`request.submitted_at >= ${add(submittedAfter)}::timestamptz`);
  const search = cleanText(filters.search, 180);
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const parameter = add(pattern);
    clauses.push(`(
      request.public_reference ilike ${parameter} escape '\\'
      or coalesce(request.sender_name, '') ilike ${parameter} escape '\\'
      or coalesce(request.sender_business_name, '') ilike ${parameter} escape '\\'
      or coalesce(request.sender_email, '') ilike ${parameter} escape '\\'
      or coalesce(request.asset_reference, '') ilike ${parameter} escape '\\'
    )`);
  }
  return { sql: clauses.join(' and '), values };
}

export async function listCaptureRequests(
  filters: CaptureRequestListFilters = {},
): Promise<CaptureRequest[]> {
  const where = buildCaptureListWhere(filters);
  const limit = Math.min(200, Math.max(1, Math.trunc(Number(filters.limit) || 50)));
  const offset = Math.min(100_000, Math.max(0, Math.trunc(Number(filters.offset) || 0)));
  const result = await getDb().query<CaptureRequestRow>(
    `${REQUEST_SELECT}
      where ${where.sql}
      order by
        case when request.status in ('completed', 'declined', 'rejected', 'cancelled') then 1 else 0 end asc,
        request.due_at asc,
        request.submitted_at asc,
        request.id asc
      limit ${limit} offset ${offset}`,
    where.values,
  );
  return result.rows.map(mapRequestRow);
}

export async function countCaptureRequests(
  filters: CaptureRequestListFilters = {},
): Promise<number> {
  const where = buildCaptureListWhere(filters);
  const result = await getDb().query<{ count: string } & QueryResultRow>(
    `select count(*)::text as count from public.document_capture_requests request where ${where.sql}`,
    where.values,
  );
  return Math.max(0, Math.trunc(asNumber(result.rows[0]?.count)));
}

export async function getCaptureQueueCounts(now: Date = new Date()): Promise<CaptureQueueCounts> {
  if (!Number.isFinite(now.getTime())) throw new Error('CAPTURE_FILTER_DATE_INVALID');
  const result = await getDb().query<CaptureQueueCountRow>(
    `
      select
        count(*) filter (
          where status not in ('completed', 'declined', 'rejected', 'cancelled')
        )::integer as total_open,
        count(*) filter (
          where assigned_admin_user_id is null
            and status not in ('completed', 'declined', 'rejected', 'cancelled')
        )::integer as unassigned,
        count(*) filter (
          where due_at < $1::timestamptz
            and status not in ('awaiting_owner', 'completed', 'declined', 'rejected', 'cancelled')
        )::integer as overdue,
        count(*) filter (
          where due_at >= $1::timestamptz
            and due_at <= $1::timestamptz + interval '24 hours'
            and status not in ('awaiting_owner', 'completed', 'declined', 'rejected', 'cancelled')
        )::integer as due_within_24_hours,
        count(*) filter (where status = 'needs_matching')::integer as needs_matching,
        count(*) filter (where status = 'needs_information')::integer as needs_information,
        count(*) filter (where status = 'awaiting_owner')::integer as awaiting_owner,
        count(*) filter (
          where status = 'completed'
            and completed_at >= (date_trunc('day', $1::timestamptz at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg')
            and completed_at < (date_trunc('day', $1::timestamptz at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg') + interval '24 hours'
        )::integer as completed_today
      from public.document_capture_requests
    `,
    [now.toISOString()],
  );
  const row = result.rows[0];
  return {
    totalOpen: Math.max(0, Math.trunc(asNumber(row?.total_open))),
    unassigned: Math.max(0, Math.trunc(asNumber(row?.unassigned))),
    overdue: Math.max(0, Math.trunc(asNumber(row?.overdue))),
    dueWithin24Hours: Math.max(0, Math.trunc(asNumber(row?.due_within_24_hours))),
    needsMatching: Math.max(0, Math.trunc(asNumber(row?.needs_matching))),
    needsInformation: Math.max(0, Math.trunc(asNumber(row?.needs_information))),
    awaitingOwner: Math.max(0, Math.trunc(asNumber(row?.awaiting_owner))),
    completedToday: Math.max(0, Math.trunc(asNumber(row?.completed_today))),
  };
}

function assertClaimedBy(row: CaptureRequestRow, actor: Required<CaptureAdminActor>): void {
  if (!row.assigned_admin_user_id || row.assigned_admin_user_id !== actor.userId) {
    throw new Error(row.assigned_admin_user_id ? 'CAPTURE_CLAIMED_BY_ANOTHER_ADMIN' : 'CAPTURE_NOT_CLAIMED');
  }
}

export async function claimCaptureRequest(
  requestId: string,
  adminActor: CaptureAdminActor,
): Promise<CaptureRequest> {
  const id = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const actor = normalizeAdminActor(adminActor);

  return withTransaction(async (client) => {
    await assertCaptureRequestNotFinalizing(client, id);
    const existing = await getLockedRequest(client, id);
    const fromStatus = enumValue(existing.status, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID');
    if (TERMINAL_STATUSES.has(fromStatus) || fromStatus === 'awaiting_owner') {
      throw new Error('CAPTURE_REQUEST_NOT_CLAIMABLE');
    }
    if (existing.assigned_admin_user_id && existing.assigned_admin_user_id !== actor.userId) {
      throw new Error('CAPTURE_CLAIMED_BY_ANOTHER_ADMIN');
    }
    if (existing.assigned_admin_user_id === actor.userId) return getRequestWithCounts(client, id);

    const toStatus: CaptureRequestStatus = fromStatus === 'submitted' || fromStatus === 'needs_matching'
      ? 'in_progress'
      : fromStatus;
    await client.query(
      `update public.document_capture_requests
          set assigned_admin_user_id = $2,
              assigned_admin_display_name = $3,
              claimed_at = now(),
              status = $4
        where id = $1::uuid`,
      [id, actor.userId, actor.displayName, toStatus],
    );
    await insertEvent(client, {
      requestId: id,
      eventType: 'claimed',
      actor,
      fromStatus,
      toStatus,
      metadata: { assignedAdminUserId: actor.userId },
    });
    return getRequestWithCounts(client, id);
  });
}

export async function updateCaptureRequestDraft(
  requestId: string,
  input: CaptureRequestDraftInput,
  adminActor: CaptureAdminActor,
): Promise<CaptureRequest> {
  const id = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const actor = normalizeAdminActor(adminActor);
  const hasCandidatePayload = input.candidatePayload !== undefined;
  const hasCapturedPayload = input.capturedPayload !== undefined;
  const hasAdminNote = input.adminNote !== undefined;
  const expectedVersion = input.expectedVersion === undefined || input.expectedVersion === null
    ? null
    : Math.trunc(Number(input.expectedVersion));
  if (expectedVersion !== null && (!Number.isFinite(expectedVersion) || expectedVersion < 1)) {
    throw new Error('CAPTURE_REQUEST_CHANGED');
  }
  if (!hasCandidatePayload && !hasCapturedPayload && !hasAdminNote) {
    throw new Error('CAPTURE_DRAFT_EMPTY');
  }
  const candidatePayload = hasCandidatePayload ? normalizePayload(input.candidatePayload) : null;
  const capturedPayload = hasCapturedPayload ? normalizePayload(input.capturedPayload) : null;
  const adminNote = hasAdminNote ? cleanMultilineText(input.adminNote, 10_000) : null;

  return withTransaction(async (client) => {
    await assertCaptureRequestNotFinalizing(client, id);
    const existing = await getLockedRequest(client, id);
    const status = enumValue(existing.status, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID');
    if (TERMINAL_STATUSES.has(status) || status === 'awaiting_owner') throw new Error('CAPTURE_REQUEST_CLOSED');
    assertClaimedBy(existing, actor);
    if (expectedVersion !== null && asNumber(existing.version) !== expectedVersion) {
      throw new Error('CAPTURE_REQUEST_CHANGED');
    }

    await client.query(
      `update public.document_capture_requests
          set candidate_payload = case when $2::boolean then $3::jsonb else candidate_payload end,
              captured_payload = case when $4::boolean then $5::jsonb else captured_payload end,
              admin_note = case when $6::boolean then $7 else admin_note end
        where id = $1::uuid`,
      [
        id,
        hasCandidatePayload,
        JSON.stringify(candidatePayload ?? {}),
        hasCapturedPayload,
        JSON.stringify(capturedPayload ?? {}),
        hasAdminNote,
        adminNote ?? '',
      ],
    );
    await insertEvent(client, {
      requestId: id,
      eventType: 'draft_saved',
      actor,
      fromStatus: status,
      toStatus: status,
      metadata: {
        candidatePayloadUpdated: hasCandidatePayload,
        capturedPayloadUpdated: hasCapturedPayload,
        adminNoteUpdated: hasAdminNote,
      },
    });
    return getRequestWithCounts(client, id);
  });
}

function captureUsageReading(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== 'string' || !value.trim()) return null;

  let normalized = value.trim().replace(/\s+/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (/^\d{1,3}(,\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/,/g, '');
  } else {
    normalized = normalized.replace(',', '.');
  }

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function capturePayloadBoolean(value: unknown): boolean {
  if (value === true || value === 1) return true;
  return ['true', '1', 'yes', 'on'].includes(cleanText(value, 20).toLowerCase());
}

function markCaptureUsageValuationStale(
  specs: Record<string, unknown>,
  nowIso: string,
): Record<string, unknown> {
  const reason = 'Asset usage updated from Admin Capture';
  const existingReasons = [specs.valuationStaleReasons, specs.valuation_stale_reasons]
    .flatMap((value) => Array.isArray(value) ? value : [])
    .map((value) => cleanText(value, 200))
    .filter(Boolean);
  const reasons = Array.from(new Set([...existingReasons, reason]));
  const staleSince = cleanText(
    specs.valuationStaleSince ?? specs.valuation_stale_since,
    80,
  ) || nowIso;

  return {
    ...specs,
    valuationNeedsUpdate: true,
    valuation_needs_update: true,
    valuationStaleSince: staleSince,
    valuation_stale_since: staleSince,
    valuationStaleReason: reasons.join(', '),
    valuation_stale_reason: reasons.join(', '),
    valuationStaleReasons: reasons,
    valuation_stale_reasons: reasons,
  };
}

export async function updateCaptureRequestAssetUsage(
  requestId: string,
  input: { expectedVersion: number },
  adminActor: CaptureAdminActor,
): Promise<CaptureRequestAssetUsageUpdateResult> {
  const id = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const actor = normalizeAdminActor(adminActor);
  const expectedVersion = Number(input?.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error('CAPTURE_REQUEST_CHANGED');
  }

  return withTransaction(async (client) => {
    await assertCaptureRequestNotFinalizing(client, id);
    const existing = await getLockedRequest(client, id);
    const status = enumValue(existing.status, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID');
    if (status !== 'in_progress' && status !== 'needs_information') {
      throw new Error('CAPTURE_USAGE_STATUS_INVALID');
    }
    assertClaimedBy(existing, actor);
    if (asNumber(existing.version) !== expectedVersion) {
      throw new Error('CAPTURE_REQUEST_CHANGED');
    }

    const ownerUserId = existing.owner_user_id ? String(existing.owner_user_id) : '';
    const assetId = existing.asset_register_item_id ? String(existing.asset_register_item_id) : '';
    if (!ownerUserId || !assetId || existing.fuel_storage_id) {
      throw new Error('CAPTURE_TARGET_REQUIRED');
    }

    const latestMatchResult = await client.query<{ metadata: unknown } & QueryResultRow>(
      `select metadata
         from public.document_capture_events
        where capture_request_id = $1::uuid
          and event_type = 'matched'
        order by created_at desc, id desc
        limit 1`,
      [id],
    );
    const latestMatch = jsonObject(latestMatchResult.rows[0]?.metadata);
    const matchedOwnerUserId = cleanText(latestMatch.ownerUserId, 200);
    const matchedAssetId = cleanText(latestMatch.assetId, 80);
    const matchedFuelStorageId = cleanText(latestMatch.fuelStorageId, 80);
    if (
      matchedOwnerUserId !== ownerUserId
      || matchedAssetId !== assetId
      || matchedFuelStorageId
    ) {
      throw new Error('CAPTURE_TARGET_NOT_CONFIRMED');
    }

    const assetResult = await client.query<CaptureUsageAssetRow>(
      `select
         asset.kind,
         asset.hours,
         asset.life_worked_percent,
         coalesce(asset.specs_json, '{}'::jsonb) as specs_json,
         to_jsonb(asset) ->> 'valuation_run_id' as valuation_run_id
       from public.asset_register_items asset
       where asset.user_id = $1
         and asset.id = $2::uuid
       for update`,
      [ownerUserId, assetId],
    );
    const asset = assetResult.rows[0];
    if (!asset) throw new Error('CAPTURE_TARGET_MISMATCH');

    const specs = jsonObject(asset.specs_json);
    const resolvedUsage = resolveAssetUsage({
      kind: asset.kind,
      hours: asset.hours,
      lifeWorkedPercent: asset.life_worked_percent,
      specsJson: specs,
    });
    if (resolvedUsage.metric !== 'hours' && resolvedUsage.metric !== 'km') {
      throw new Error('CAPTURE_USAGE_NOT_APPLICABLE');
    }
    const metric = resolvedUsage.metric;
    const capturedPayload = jsonObject(existing.captured_payload);
    let newReading: number | null = null;

    if (existing.request_type === 'invoice') {
      const capturedMetric = cleanText(capturedPayload.usageMetric, 30).toLowerCase();
      if (capturedMetric !== metric) throw new Error('CAPTURE_USAGE_METRIC_MISMATCH');
      newReading = captureUsageReading(capturedPayload.usageReading);
    } else if (existing.request_type === 'fuel_slip') {
      if (capturePayloadBoolean(capturedPayload.usageNotApplicable)) {
        throw new Error('CAPTURE_USAGE_NOT_APPLICABLE');
      }
      newReading = captureUsageReading(
        metric === 'km'
          ? capturedPayload.odometerReading
          : capturedPayload.hourMeterReading,
      );
    } else {
      throw new Error('CAPTURE_TYPE_INVALID');
    }

    if (newReading === null) throw new Error('CAPTURE_USAGE_READING_REQUIRED');
    const previousCandidates = [
      captureUsageReading(asset.hours),
      captureUsageReading(resolvedUsage.value),
    ].filter((value): value is number => value !== null);
    const previousReading = previousCandidates.length
      ? Math.max(...previousCandidates)
      : null;
    if (previousReading !== null && newReading < previousReading) {
      throw new Error('CAPTURE_USAGE_CANNOT_DECREASE');
    }

    if (previousReading !== null && newReading === previousReading) {
      return {
        request: await getRequestWithCounts(client, id),
        updated: false,
        metric,
        previousReading,
        newReading,
      };
    }

    const hasSavedValuation = Boolean(asset.valuation_run_id);
    const nextSpecs = hasSavedValuation
      ? markCaptureUsageValuationStale(specs, new Date().toISOString())
      : specs;
    await client.query(
      `update public.asset_register_items
          set hours = greatest(coalesce(hours, $3::numeric), $3::numeric),
              specs_json = case when $4::boolean then $5::jsonb else specs_json end,
              updated_at = now()
        where user_id = $1
          and id = $2::uuid`,
      [ownerUserId, assetId, newReading, hasSavedValuation, JSON.stringify(nextSpecs)],
    );
    await insertEvent(client, {
      requestId: id,
      eventType: 'note_added',
      actor,
      fromStatus: status,
      toStatus: status,
      note: `Updated asset ${metric === 'km' ? 'kilometres' : 'hours'} to ${newReading}.`,
      metadata: {
        action: 'asset_usage_updated',
        ownerUserId,
        assetId,
        metric,
        previousReading,
        newReading,
      },
    });

    return {
      request: await getRequestWithCounts(client, id),
      updated: true,
      metric,
      previousReading,
      newReading,
    };
  });
}

export async function matchCaptureRequest(
  requestId: string,
  input: CaptureRequestMatchInput,
  adminActor: CaptureAdminActor,
): Promise<CaptureRequest> {
  const id = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const actor = normalizeAdminActor(adminActor);
  const ownerUserId = cleanText(input.ownerUserId, 200);
  if (!ownerUserId) throw new Error('CAPTURE_OWNER_REQUIRED');
  const assetId = optionalUuid(input.assetId, 'CAPTURE_ASSET_INVALID');
  const fuelStorageId = optionalUuid(input.fuelStorageId, 'CAPTURE_FUEL_STORAGE_INVALID');
  const expectedVersion = Number(input.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error('CAPTURE_REQUEST_CHANGED');
  }

  return withTransaction(async (client) => {
    await assertCaptureRequestNotFinalizing(client, id);
    const existing = await getLockedRequest(client, id);
    if (asNumber(existing.version) !== expectedVersion) {
      throw new Error('CAPTURE_REQUEST_CHANGED');
    }
    const status = enumValue(existing.status, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID');
    const requestType = enumValue(existing.request_type, CAPTURE_REQUEST_TYPES, 'CAPTURE_TYPE_INVALID');
    if (TERMINAL_STATUSES.has(status) || status === 'awaiting_owner') throw new Error('CAPTURE_REQUEST_CLOSED');
    assertClaimedBy(existing, actor);

    if (requestType === 'invoice' && (!assetId || fuelStorageId)) throw new Error('CAPTURE_TARGET_INVALID');
    if (requestType === 'fuel_slip' && Boolean(assetId) === Boolean(fuelStorageId)) {
      throw new Error('CAPTURE_TARGET_INVALID');
    }
    await assertTargetOwnership(client, { ownerUserId, assetId, fuelStorageId });

    if (existing.submission_channel === 'dealer_upload'
      && (existing.owner_user_id !== ownerUserId || existing.asset_register_item_id !== assetId)) {
      throw new Error('CAPTURE_TARGET_INVALID');
    }

    if (existing.invoice_drop_code_id) {
      const code = await client.query<DropCodeRow>(
        `select id, owner_user_id, asset_register_item_id, code_last_four, created_at
           from public.asset_invoice_drop_codes
          where id = $1::uuid
          limit 1`,
        [existing.invoice_drop_code_id],
      );
      const codeAssetId = code.rows[0]?.asset_register_item_id
        ? String(code.rows[0].asset_register_item_id)
        : null;
      if (
        !code.rows[0]
        || code.rows[0].owner_user_id !== ownerUserId
        || (codeAssetId && codeAssetId !== assetId)
      ) {
        throw new Error('CAPTURE_DROP_CODE_MISMATCH');
      }
    }

    await client.query(
      `update public.document_capture_requests
          set owner_user_id = $2,
              asset_register_item_id = $3::uuid,
              fuel_storage_id = $4::uuid,
              status = 'in_progress',
              needs_information_reason = null
        where id = $1::uuid`,
      [id, ownerUserId, assetId, fuelStorageId],
    );
    await insertEvent(client, {
      requestId: id,
      eventType: 'matched',
      actor,
      fromStatus: status,
      toStatus: 'in_progress',
      metadata: { ownerUserId, assetId, fuelStorageId },
    });
    return getRequestWithCounts(client, id);
  });
}

async function assertFilesReady(client: Queryable, requestId: string): Promise<void> {
  const result = await client.query<{
    clean_count: number | string;
    pending_count: number | string;
  } & QueryResultRow>(
    `select
       count(*) filter (where security_status = 'clean')::integer as clean_count,
       count(*) filter (where security_status = 'pending')::integer as pending_count
     from public.document_capture_files
     where capture_request_id = $1::uuid`,
    [requestId],
  );
  if (asNumber(result.rows[0]?.clean_count) < 1) throw new Error('CAPTURE_CLEAN_FILE_REQUIRED');
  if (asNumber(result.rows[0]?.pending_count) > 0) throw new Error('CAPTURE_FILE_SECURITY_PENDING');
}

async function assertCaptureRequestNotFinalizing(
  client: Queryable,
  requestId: string,
): Promise<void> {
  const result = await client.query<{ locked: boolean } & QueryResultRow>(
    `select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as locked`,
    [`capture-finalization:${requestId}`],
  );
  if (!result.rows[0]?.locked) throw new Error('CAPTURE_FINALIZATION_IN_PROGRESS');
}

function assertTransitionActor(
  row: CaptureRequestRow,
  fromStatus: CaptureRequestStatus,
  toStatus: CaptureRequestStatus,
  actor: Required<CaptureEventActor>,
): void {
  if (fromStatus === 'awaiting_owner' && (toStatus === 'declined' || toStatus === 'in_progress')) {
    if (actor.actorType !== 'owner' || !actor.userId || actor.userId !== row.owner_user_id) {
      throw new Error('CAPTURE_OWNER_SCOPE_FORBIDDEN');
    }
    return;
  }
  if (toStatus === 'cancelled' && actor.actorType === 'owner') {
    if (
      row.submission_channel !== 'owner_upload'
      || !actor.userId
      || actor.userId !== row.owner_user_id
    ) {
      throw new Error('CAPTURE_OWNER_SCOPE_FORBIDDEN');
    }
    return;
  }
  if (actor.actorType !== 'admin' && actor.actorType !== 'system') {
    throw new Error('CAPTURE_ADMIN_REQUIRED');
  }
  if (
    actor.actorType === 'admin'
    && row.assigned_admin_user_id
    && row.assigned_admin_user_id !== actor.userId
  ) {
    throw new Error('CAPTURE_CLAIMED_BY_ANOTHER_ADMIN');
  }
}

/** Customer messages return work to admin; they never approve or create ledger records. */
export async function sendCaptureCustomerMessage(
  requestId: string,
  input: {
    actor: CaptureEventActor;
    message: string;
    action: 'reply' | 'correction';
    expectedVersion: number;
    expectedOwnerUserId: string | null;
    expectedAssetId: string | null;
  },
): Promise<CaptureRequest> {
  const id = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const actor = normalizeActor(input.actor);
  const message = cleanMultilineText(input.message, 1_000);
  if (!message) throw new Error('CAPTURE_MESSAGE_REQUIRED');
  return withTransaction(async (client) => {
    await assertCaptureRequestNotFinalizing(client, id);
    const existing = await getLockedRequest(client, id);
    const owner = actor.actorType === 'owner' && actor.userId === existing.owner_user_id;
    const dealer = actor.actorType === 'dealer'
      && existing.submission_channel === 'dealer_upload'
      && actor.userId === existing.submitted_by_user_id;
    if (!actor.userId || (!owner && !dealer)
      || existing.owner_user_id !== input.expectedOwnerUserId
      || existing.asset_register_item_id !== input.expectedAssetId) {
      throw new Error('CAPTURE_OWNER_SCOPE_FORBIDDEN');
    }
    if (!Number.isInteger(input.expectedVersion) || asNumber(existing.version) !== input.expectedVersion) {
      throw new Error('CAPTURE_REQUEST_CHANGED');
    }
    const fromStatus = enumValue(existing.status, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID');
    const correction = input.action === 'correction';
    if ((correction && (!owner || fromStatus !== 'awaiting_owner'))
      || (!correction && fromStatus !== 'needs_information')
      || existing.final_invoice_id || existing.final_fuel_slip_id) {
      throw new Error('CAPTURE_CUSTOMER_MESSAGE_STATUS_INVALID');
    }
    // Keep the verified payload untouched. Admin must review the customer's message.
    const label = correction ? 'Correction requested' : 'Customer reply';
    await client.query(
      `update public.document_capture_requests
          set status = 'in_progress', needs_information_reason = null,
              requester_note = left(concat_ws(E'\\n\\n', $2, nullif(requester_note, '')), 5000),
              resolved_at = null
        where id = $1::uuid`,
      [id, `${label}: ${message}`],
    );
    await insertEvent(client, {
      requestId: id, eventType: 'note_added', actor,
      fromStatus, toStatus: 'in_progress', note: `${label}: ${message}`,
    });
    return getRequestWithCounts(client, id);
  });
}

export async function transitionCaptureRequest(
  requestId: string,
  toStatusInput: Exclude<CaptureRequestStatus, 'completed'>,
  options: {
    actor: CaptureEventActor;
    reason?: string | null;
    note?: string | null;
    allowDuringFinalization?: boolean;
  },
): Promise<CaptureRequest> {
  const id = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const toStatus = enumValue(
    toStatusInput,
    CAPTURE_REQUEST_STATUSES.filter((status) => status !== 'completed'),
    'CAPTURE_STATUS_INVALID',
  ) as Exclude<CaptureRequestStatus, 'completed'>;
  const actor = normalizeActor(options.actor);
  const reason = cleanMultilineText(options.reason, 2_000);
  const note = cleanMultilineText(options.note, 2_000);
  if (toStatus === 'needs_information' && !reason) throw new Error('CAPTURE_INFORMATION_REASON_REQUIRED');
  if (toStatus === 'rejected' && !reason) throw new Error('CAPTURE_REJECTION_REASON_REQUIRED');

  return withTransaction(async (client) => {
    if (!options.allowDuringFinalization) {
      await assertCaptureRequestNotFinalizing(client, id);
    }
    const existing = await getLockedRequest(client, id);
    const fromStatus = enumValue(existing.status, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID');
    if (fromStatus === toStatus) return getRequestWithCounts(client, id);
    if (!ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)) {
      throw new Error('CAPTURE_TRANSITION_INVALID');
    }
    assertTransitionActor(existing, fromStatus, toStatus, actor);
    if (toStatus === 'awaiting_owner') {
      if (!existing.owner_user_id) throw new Error('CAPTURE_OWNER_REQUIRED');
      if (existing.submission_channel === 'owner_upload') throw new Error('CAPTURE_OWNER_APPROVAL_NOT_REQUIRED');
      await assertFilesReady(client, id);
    }

    const terminal = TERMINAL_STATUSES.has(toStatus);
    await client.query(
      `update public.document_capture_requests
          set status = $2,
              needs_information_reason = case
                when $2 = 'needs_information' then nullif($3, '')
                when status = 'needs_information' then null
                else needs_information_reason
              end,
              resolved_at = case when $4::boolean then now() else null end,
              assigned_admin_user_id = case when $4::boolean then null else assigned_admin_user_id end,
              assigned_admin_display_name = case when $4::boolean then null else assigned_admin_display_name end,
              claimed_at = case when $4::boolean then null else claimed_at end
        where id = $1::uuid`,
      [id, toStatus, reason, terminal],
    );

    let eventType: CaptureEventType = 'status_changed';
    if (toStatus === 'needs_information') eventType = 'information_requested';
    if (fromStatus === 'awaiting_owner' && toStatus === 'in_progress') eventType = 'owner_approved';
    if (fromStatus === 'awaiting_owner' && toStatus === 'declined') eventType = 'owner_declined';
    await insertEvent(client, {
      requestId: id,
      eventType,
      actor,
      fromStatus,
      toStatus,
      note: reason || note,
    });
    return getRequestWithCounts(client, id);
  });
}

async function assertOwnerApproval(
  client: Queryable,
  row: CaptureRequestRow,
  overrideReason: string,
): Promise<void> {
  if (row.submission_channel !== 'public_drop') return;
  const approval = await client.query(
    `select 1 from public.document_capture_events
      where capture_request_id = $1::uuid and event_type = 'owner_approved'
      limit 1`,
    [row.id],
  );
  if (approval.rows[0]) return;
  if (!overrideReason) throw new Error('CAPTURE_OWNER_APPROVAL_REQUIRED');
}

async function assertCanonicalOutput(
  client: Queryable,
  row: CaptureRequestRow,
  outputType: CaptureRequestType,
  outputId: string,
): Promise<void> {
  if (!row.owner_user_id) throw new Error('CAPTURE_OWNER_REQUIRED');
  if (outputType !== row.request_type) throw new Error('CAPTURE_OUTPUT_TYPE_MISMATCH');
  if (outputType === 'invoice') {
    const invoice = await client.query(
      `select 1 from public.asset_invoices
        where id = $1::uuid
          and user_id = $2
          and asset_register_item_id = $3::uuid
        limit 1`,
      [outputId, row.owner_user_id, row.asset_register_item_id],
    );
    if (!invoice.rows[0]) throw new Error('CAPTURE_OUTPUT_MISMATCH');
    return;
  }
  const fuelSlip = await client.query(
    `select 1 from public.fuel_slips
      where id = $1::uuid
        and user_id = $2
        and ($3::uuid is null or asset_register_item_id = $3::uuid)
        and ($4::uuid is null or storage_id = $4::uuid)
      limit 1`,
    [outputId, row.owner_user_id, row.asset_register_item_id, row.fuel_storage_id],
  );
  if (!fuelSlip.rows[0]) throw new Error('CAPTURE_OUTPUT_MISMATCH');
}

export async function completeCaptureRequest(
  requestId: string,
  input: {
    outputType: CaptureRequestType;
    outputId: string;
    ownerApprovalOverrideReason?: string | null;
  },
  adminActor: CaptureAdminActor,
): Promise<CaptureRequest> {
  const id = asUuid(requestId, 'CAPTURE_REQUEST_NOT_FOUND');
  const outputType = enumValue(input.outputType, CAPTURE_REQUEST_TYPES, 'CAPTURE_OUTPUT_TYPE_INVALID');
  const outputId = asUuid(input.outputId, 'CAPTURE_OUTPUT_INVALID');
  const overrideReason = cleanMultilineText(input.ownerApprovalOverrideReason, 1_000);
  const actor = normalizeAdminActor(adminActor);

  return withTransaction(async (client) => {
    const existing = await getLockedRequest(client, id);
    const status = enumValue(existing.status, CAPTURE_REQUEST_STATUSES, 'CAPTURE_STATUS_INVALID');
    if (status === 'completed') {
      const sameOutput = outputType === 'invoice'
        ? existing.final_invoice_id === outputId
        : existing.final_fuel_slip_id === outputId;
      if (!sameOutput) throw new Error('CAPTURE_ALREADY_COMPLETED');
      return getRequestWithCounts(client, id);
    }
    const mayOverrideAwaitingOwner = status === 'awaiting_owner' && (existing.submission_channel === 'dealer_upload' || Boolean(overrideReason));
    if (status !== 'in_progress' && !mayOverrideAwaitingOwner) {
      throw new Error('CAPTURE_COMPLETION_STATUS_INVALID');
    }
    assertClaimedBy(existing, actor);
    if (!existing.owner_user_id || (!existing.asset_register_item_id && !existing.fuel_storage_id)) {
      throw new Error('CAPTURE_TARGET_REQUIRED');
    }
    await assertFilesReady(client, id);
    await assertOwnerApproval(client, existing, overrideReason);
    await assertCanonicalOutput(client, existing, outputType, outputId);

    const result = await client.query(
      `update public.document_capture_requests
          set status = 'completed',
              final_invoice_id = case when $2 = 'invoice' then $3::uuid else null end,
              final_fuel_slip_id = case when $2 = 'fuel_slip' then $3::uuid else null end,
              resolved_at = now(),
              completed_at = now(),
              assigned_admin_user_id = null,
              assigned_admin_display_name = null,
              claimed_at = null
        where id = $1::uuid
          and status = $4
        returning id`,
      [id, outputType, outputId, status],
    );
    if (!result.rows[0]) throw new Error('CAPTURE_COMPLETION_CONFLICT');
    await insertEvent(client, {
      requestId: id,
      eventType: 'output_linked',
      actor,
      fromStatus: status,
      toStatus: 'completed',
      note: overrideReason,
      metadata: {
        outputType,
        outputId,
        ownerApprovalOverridden: Boolean(overrideReason),
      },
    });
    return getRequestWithCounts(client, id);
  });
}
