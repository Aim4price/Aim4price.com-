import { Buffer } from 'node:buffer';
import { ensureAccountProfileColumns } from './account-profile';
import { ensureContactRequestTables } from './contact-requests';
import { getDb } from './db';
import { normalizeAccountRole, type AccountRole } from './partner-access';

export type UserMessageType = 'message' | 'ad';

export type UserMessage = {
  id: string;
  ownerUserId: string;
  senderUserId: string;
  messageType: UserMessageType;
  messageText: string;
  adCaption: string;
  senderAccountType: AccountRole;
  senderDisplayName: string;
  senderBusinessName: string;
  senderPhone: string;
  senderEmail: string;
  senderLocation: string;
  imageFileName: string;
  imageMimeType: string;
  imageSizeBytes: number;
  imageUrl: string;
  hasImage: boolean;
  documentFileName: string;
  documentMimeType: string;
  documentSizeBytes: number;
  documentUrl: string;
  hasDocument: boolean;
  readAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type UserMessageAttachment = {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

type UserMessageRow = {
  id: string;
  owner_user_id: string;
  sender_user_id: string;
  message_type: string | null;
  message_text: string | null;
  ad_caption: string | null;
  sender_account_type: string | null;
  sender_display_name: string | null;
  sender_business_name: string | null;
  sender_phone: string | null;
  sender_email: string | null;
  sender_location: string | null;
  image_file_name: string | null;
  image_mime_type: string | null;
  image_size_bytes: number | string | null;
  has_image: boolean | null;
  document_file_name: string | null;
  document_mime_type: string | null;
  document_size_bytes: number | string | null;
  has_document: boolean | null;
  read_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AccountRoleRow = {
  account_type: string | null;
};

type ContactRequestAccessRow = {
  status: string | null;
};

type ImageAttachmentRow = {
  image_file_name: string | null;
  image_mime_type: string | null;
  image_size_bytes: number | string | null;
  image_bytes: Buffer | Uint8Array | null;
};

type DocumentAttachmentRow = {
  document_file_name: string | null;
  document_mime_type: string | null;
  document_size_bytes: number | string | null;
  document_bytes: Buffer | Uint8Array | null;
};

const MAX_TEXT_LENGTH = 2200;
const MAX_CAPTION_LENGTH = 900;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const DOCUMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
let userMessageTablesEnsured = false;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asInt(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
}

function isoNowFallback(value: string | null | undefined): string {
  return value || new Date().toISOString();
}

function normalizeMessageType(value: unknown): UserMessageType {
  return asText(value).toLowerCase() === 'ad' ? 'ad' : 'message';
}

function trimText(value: unknown, maxLength: number): string {
  return asText(value).replace(/\s+/g, ' ').slice(0, maxLength).trim();
}

function sanitizeFileName(value: unknown, fallback = 'aim4price-file'): string {
  const clean = asText(value)
    .replace(/[\\/\0\r\n]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return clean.slice(0, 180) || fallback;
}

function normalizeImageMimeType(value: unknown): string {
  const mimeType = asText(value).toLowerCase();
  return ALLOWED_IMAGE_TYPES.has(mimeType) ? mimeType : '';
}

function mimeTypeFromDocumentExtension(fileName: string): string {
  const extension = fileName.split('.').pop()?.trim().toLowerCase() ?? '';
  return DOCUMENT_MIME_BY_EXTENSION[extension] ?? '';
}

function normalizeDocumentMimeType(value: unknown, fileName: string): string {
  const mimeType = asText(value).toLowerCase();

  if (ALLOWED_DOCUMENT_TYPES.has(mimeType)) {
    return mimeType;
  }

  return mimeTypeFromDocumentExtension(fileName);
}

function mapMessageRow(row: UserMessageRow): UserMessage {
  const hasImage = Boolean(row.has_image);
  const hasDocument = Boolean(row.has_document);
  const id = row.id;

  return {
    id,
    ownerUserId: row.owner_user_id,
    senderUserId: row.sender_user_id,
    messageType: normalizeMessageType(row.message_type),
    messageText: asText(row.message_text),
    adCaption: asText(row.ad_caption),
    senderAccountType: normalizeAccountRole(row.sender_account_type),
    senderDisplayName: asText(row.sender_display_name),
    senderBusinessName: asText(row.sender_business_name),
    senderPhone: asText(row.sender_phone),
    senderEmail: asText(row.sender_email),
    senderLocation: asText(row.sender_location),
    imageFileName: asText(row.image_file_name),
    imageMimeType: asText(row.image_mime_type),
    imageSizeBytes: asInt(row.image_size_bytes),
    imageUrl: hasImage ? `/api/users/messages/${encodeURIComponent(id)}/image` : '',
    hasImage,
    documentFileName: asText(row.document_file_name),
    documentMimeType: asText(row.document_mime_type),
    documentSizeBytes: asInt(row.document_size_bytes),
    documentUrl: hasDocument ? `/api/users/messages/${encodeURIComponent(id)}/document` : '',
    hasDocument,
    readAtIso: row.read_at,
    createdAtIso: isoNowFallback(row.created_at),
    updatedAtIso: isoNowFallback(row.updated_at),
  };
}

export function userMessageSenderName(message: Pick<UserMessage, 'senderBusinessName' | 'senderDisplayName'>): string {
  return message.senderBusinessName || message.senderDisplayName || 'An Aim4price user';
}

export async function ensureUserMessageTables(): Promise<void> {
  if (userMessageTablesEnsured) {
    return;
  }

  await ensureAccountProfileColumns();
  const db = getDb();

  await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await db.query(`
    create table if not exists account_user_messages (
      id uuid primary key default gen_random_uuid(),
      owner_user_id text not null,
      sender_user_id text not null,
      message_type text not null default 'message',
      message_text text not null default '',
      ad_caption text not null default '',
      image_file_name text,
      image_mime_type text,
      image_size_bytes integer,
      image_bytes bytea,
      document_file_name text,
      document_mime_type text,
      document_size_bytes integer,
      document_bytes bytea,
      read_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table account_user_messages
      add column if not exists owner_user_id text,
      add column if not exists sender_user_id text,
      add column if not exists message_type text not null default 'message',
      add column if not exists message_text text not null default '',
      add column if not exists ad_caption text not null default '',
      add column if not exists image_file_name text,
      add column if not exists image_mime_type text,
      add column if not exists image_size_bytes integer,
      add column if not exists image_bytes bytea,
      add column if not exists document_file_name text,
      add column if not exists document_mime_type text,
      add column if not exists document_size_bytes integer,
      add column if not exists document_bytes bytea,
      add column if not exists read_at timestamptz,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now()
  `);

  await db.query(`
    alter table account_user_messages
      drop constraint if exists account_user_messages_type_check
  `);

  await db.query(`
    alter table account_user_messages
      add constraint account_user_messages_type_check check (message_type in ('message', 'ad'))
  `);

  await db.query(`
    create index if not exists idx_account_user_messages_owner_read_created
      on account_user_messages(owner_user_id, read_at, created_at desc)
  `);

  await db.query(`
    create index if not exists idx_account_user_messages_sender_created
      on account_user_messages(sender_user_id, created_at desc)
  `);

  userMessageTablesEnsured = true;
}

async function getAccountRole(userId: string): Promise<AccountRole> {
  await ensureUserMessageTables();
  const db = getDb();
  const result = await db.query<AccountRoleRow>('select account_type from account_profiles where user_id = $1 limit 1', [userId]);
  return normalizeAccountRole(result.rows[0]?.account_type);
}

async function assertOwnerCanReceiveUserMessage(input: {
  senderUserId: string;
  ownerUserId: string;
}): Promise<void> {
  await ensureContactRequestTables();

  const db = getDb();
  const result = await db.query<ContactRequestAccessRow>(
    `
      select
        case
          when permanently_denied_at is not null or status = 'permanently_denied' then 'permanently_denied'
          when status in ('temporarily_denied', 'denied') then 'temporarily_denied'
          when status = 'approved' then 'approved'
          when status = 'pending' then 'pending'
          else null
        end as status
      from account_contact_requests
      where owner_user_id = $1
        and requester_user_id = $2
      limit 1
    `,
    [input.ownerUserId, input.senderUserId],
  );

  const status = asText(result.rows[0]?.status).toLowerCase();

  if (status === 'permanently_denied') {
    throw new Error('Permanently denied. You cannot send messages or ads to this owner account.');
  }

  if (status === 'temporarily_denied') {
    throw new Error('Temporarily denied. You cannot send messages or ads to this owner account.');
  }
}

function messageSelectSql(whereClause: string): string {
  return `
    select
      m.id::text,
      m.owner_user_id,
      m.sender_user_id,
      m.message_type,
      m.message_text,
      m.ad_caption,
      sender.account_type as sender_account_type,
      sender.display_name as sender_display_name,
      sender.business_name as sender_business_name,
      sender.phone as sender_phone,
      sender.marketplace_email as sender_email,
      concat_ws(', ', nullif(sender.town_city, ''), nullif(sender.province, '')) as sender_location,
      m.image_file_name,
      m.image_mime_type,
      m.image_size_bytes,
      (m.image_bytes is not null) as has_image,
      m.document_file_name,
      m.document_mime_type,
      m.document_size_bytes,
      (m.document_bytes is not null) as has_document,
      m.read_at::text,
      m.created_at::text,
      m.updated_at::text
    from account_user_messages m
    left join account_profiles sender on sender.user_id = m.sender_user_id
    ${whereClause}
  `;
}

export async function createUserMessage(input: {
  senderUserId: string;
  ownerUserId: string;
  messageType: UserMessageType;
  messageText?: unknown;
  adCaption?: unknown;
  imageFileName?: unknown;
  imageMimeType?: unknown;
  imageBytes?: Buffer | Uint8Array | null;
  documentFileName?: unknown;
  documentMimeType?: unknown;
  documentBytes?: Buffer | Uint8Array | null;
}): Promise<UserMessage> {
  await ensureUserMessageTables();

  const ownerUserId = asText(input.ownerUserId);
  const senderUserId = asText(input.senderUserId);
  const messageType = normalizeMessageType(input.messageType);
  const messageText = trimText(input.messageText, MAX_TEXT_LENGTH);
  const adCaption = trimText(input.adCaption, MAX_CAPTION_LENGTH);
  const imageFileName = sanitizeFileName(input.imageFileName, 'aim4price-ad-image');
  const imageMimeType = normalizeImageMimeType(input.imageMimeType);
  const imageBytes = input.imageBytes ? Buffer.from(input.imageBytes) : null;
  const documentFileName = sanitizeFileName(input.documentFileName, 'aim4price-document');
  const documentMimeType = normalizeDocumentMimeType(input.documentMimeType, documentFileName);
  const normalizedDocumentBytes = input.documentBytes ? Buffer.from(input.documentBytes) : null;
  const documentAttachment = normalizedDocumentBytes && normalizedDocumentBytes.byteLength > 0
    ? {
        bytes: normalizedDocumentBytes,
        fileName: documentFileName,
        mimeType: documentMimeType,
        sizeBytes: normalizedDocumentBytes.byteLength,
      }
    : null;

  if (!ownerUserId || !senderUserId || ownerUserId === senderUserId) {
    throw new Error('Choose a valid owner account.');
  }

  const [senderRole, ownerRole] = await Promise.all([getAccountRole(senderUserId), getAccountRole(ownerUserId)]);

  if (senderRole === 'owner') {
    throw new Error('Only finance, insurance and dealer accounts can send owners messages or ads.');
  }

  if (ownerRole !== 'owner') {
    throw new Error('Owner account not found.');
  }

  await assertOwnerCanReceiveUserMessage({
    senderUserId,
    ownerUserId,
  });

  if (messageType === 'message' && !messageText) {
    throw new Error('Type a message before sending.');
  }

  if (messageType === 'ad') {
    if (!imageBytes || !imageBytes.byteLength) {
      throw new Error('Upload an ad image before sending.');
    }

    if (!imageMimeType) {
      throw new Error('Use a JPG, PNG or WebP image for the ad.');
    }

    if (imageBytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('The ad image is too large. Please upload an image smaller than 8 MB.');
    }
  }

  if (documentAttachment) {
    if (!documentAttachment.mimeType) {
      throw new Error('Attach a supported document: PDF, Word, Excel, CSV, JPG, PNG or WebP.');
    }

    if (documentAttachment.sizeBytes > MAX_DOCUMENT_BYTES) {
      throw new Error('The attached document is too large. Please upload a file smaller than 10 MB.');
    }
  }

  const db = getDb();
  const inserted = await db.query<{ id: string }>(
    `
      insert into account_user_messages (
        owner_user_id,
        sender_user_id,
        message_type,
        message_text,
        ad_caption,
        image_file_name,
        image_mime_type,
        image_size_bytes,
        image_bytes,
        document_file_name,
        document_mime_type,
        document_size_bytes,
        document_bytes,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now())
      returning id::text
    `,
    [
      ownerUserId,
      senderUserId,
      messageType,
      messageText,
      adCaption,
      messageType === 'ad' ? imageFileName : null,
      messageType === 'ad' ? imageMimeType : null,
      messageType === 'ad' && imageBytes ? imageBytes.byteLength : null,
      messageType === 'ad' ? imageBytes : null,
      documentAttachment ? documentAttachment.fileName : null,
      documentAttachment ? documentAttachment.mimeType : null,
      documentAttachment ? documentAttachment.sizeBytes : null,
      documentAttachment ? documentAttachment.bytes : null,
    ],
  );

  const id = inserted.rows[0]?.id;
  if (!id) {
    throw new Error('Failed to send message.');
  }

  const message = await getUserMessageForOwner(ownerUserId, id);
  if (!message) {
    throw new Error('Failed to load sent message.');
  }

  return message;
}

export async function listIncomingUserMessagesForOwner(ownerUserId: string, limit = 80): Promise<UserMessage[]> {
  await ensureUserMessageTables();
  const db = getDb();
  const result = await db.query<UserMessageRow>(
    `
      ${messageSelectSql('where m.owner_user_id = $1')}
      order by m.created_at desc, m.id desc
      limit $2
    `,
    [ownerUserId, Math.min(Math.max(asInt(limit) || 80, 1), 150)],
  );

  return result.rows.map(mapMessageRow);
}

export async function listUnreadUserMessagesForOwner(ownerUserId: string, limit = 12): Promise<UserMessage[]> {
  await ensureUserMessageTables();
  const db = getDb();
  const result = await db.query<UserMessageRow>(
    `
      ${messageSelectSql('where m.owner_user_id = $1 and m.read_at is null')}
      order by m.created_at desc, m.id desc
      limit $2
    `,
    [ownerUserId, Math.min(Math.max(asInt(limit) || 12, 1), 30)],
  );

  return result.rows.map(mapMessageRow);
}

export async function getUserMessageForOwner(ownerUserId: string, messageId: string): Promise<UserMessage | null> {
  await ensureUserMessageTables();
  const db = getDb();
  const result = await db.query<UserMessageRow>(
    `${messageSelectSql('where m.owner_user_id = $1 and m.id = $2::uuid')} limit 1`,
    [ownerUserId, messageId],
  );

  return result.rows[0] ? mapMessageRow(result.rows[0]) : null;
}

export async function markUserMessageRead(ownerUserId: string, messageId: string): Promise<UserMessage> {
  await ensureUserMessageTables();
  const db = getDb();

  await db.query(
    `
      update account_user_messages
      set read_at = coalesce(read_at, now()),
          updated_at = now()
      where owner_user_id = $1
        and id = $2::uuid
    `,
    [ownerUserId, messageId],
  );

  const message = await getUserMessageForOwner(ownerUserId, messageId);
  if (!message) {
    throw new Error('MESSAGE_NOT_FOUND');
  }

  return message;
}

export async function getUserMessageAttachment(ownerUserId: string, messageId: string): Promise<UserMessageAttachment | null> {
  await ensureUserMessageTables();
  const db = getDb();
  const result = await db.query<ImageAttachmentRow>(
    `
      select image_file_name, image_mime_type, image_size_bytes, image_bytes
      from account_user_messages
      where owner_user_id = $1
        and id = $2::uuid
        and image_bytes is not null
      limit 1
    `,
    [ownerUserId, messageId],
  );
  const row = result.rows[0];

  if (!row?.image_bytes) {
    return null;
  }

  const bytes = Buffer.from(row.image_bytes);

  return {
    bytes,
    fileName: sanitizeFileName(row.image_file_name, 'aim4price-ad-image'),
    mimeType: normalizeImageMimeType(row.image_mime_type) || 'application/octet-stream',
    sizeBytes: asInt(row.image_size_bytes) || bytes.byteLength,
  };
}

export async function getUserMessageDocumentAttachment(ownerUserId: string, messageId: string): Promise<UserMessageAttachment | null> {
  await ensureUserMessageTables();
  const db = getDb();
  const result = await db.query<DocumentAttachmentRow>(
    `
      select document_file_name, document_mime_type, document_size_bytes, document_bytes
      from account_user_messages
      where owner_user_id = $1
        and id = $2::uuid
        and document_bytes is not null
      limit 1
    `,
    [ownerUserId, messageId],
  );
  const row = result.rows[0];

  if (!row?.document_bytes) {
    return null;
  }

  const bytes = Buffer.from(row.document_bytes);
  const fileName = sanitizeFileName(row.document_file_name, 'aim4price-document');

  return {
    bytes,
    fileName,
    mimeType: normalizeDocumentMimeType(row.document_mime_type, fileName) || 'application/octet-stream',
    sizeBytes: asInt(row.document_size_bytes) || bytes.byteLength,
  };
}
