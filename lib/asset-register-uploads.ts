import { randomUUID } from 'node:crypto';

export const MAX_ASSET_REGISTER_PHOTOS = 12;
export const MAX_ASSET_REGISTER_DOCUMENTS = 20;
export const MAX_ASSET_REGISTER_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES = 12 * 1024 * 1024;
export const ALLOWED_ASSET_REGISTER_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export const ALLOWED_ASSET_REGISTER_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export const ALLOWED_ASSET_REGISTER_DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

type CreateAssetRegisterUploadInput = {
  userId: string;
  file: File;
};

type CreatedAssetRegisterUpload = {
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

type LegacyAssetRegisterUploadResponse = {
  data: Buffer;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
};

function sanitizeFileName(value: string): string {
  const trimmed = String(value ?? '').trim();
  return trimmed || 'asset-register-upload';
}

function normalizeUploadId(value: string): string {
  return String(value ?? '').trim();
}

export function getFileExtension(value: string): string {
  const fileName = String(value ?? '').trim().toLowerCase();
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex) : '';
}

export function isAllowedAssetRegisterDocument(file: File): boolean {
  const contentType = String(file.type ?? '').trim().toLowerCase();
  const extension = getFileExtension(file.name);
  return ALLOWED_ASSET_REGISTER_DOCUMENT_TYPES.has(contentType) || ALLOWED_ASSET_REGISTER_DOCUMENT_EXTENSIONS.has(extension);
}

export async function createAssetRegisterUpload(
  input: CreateAssetRegisterUploadInput,
): Promise<CreatedAssetRegisterUpload> {
  const contentType = String(input.file.type ?? '').trim().toLowerCase();
  const byteSize = Number(input.file.size) || 0;
  const fileName = sanitizeFileName(input.file.name);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const base64 = buffer.toString('base64');
  const url = `data:${contentType || 'application/octet-stream'};base64,${base64}`;

  return {
    id: randomUUID(),
    url,
    fileName,
    contentType: contentType || 'application/octet-stream',
    byteSize,
  };
}

export function buildAssetRegisterUploadUrl(uploadId: string): string {
  return normalizeUploadId(uploadId);
}

export function listInternalAssetRegisterUploadIds(uploads: string[]): string[] {
  const seen = new Set<string>();

  return uploads
    .map((upload) => String(upload ?? '').trim())
    .filter((upload) => upload.startsWith('/api/asset-register/uploads/'))
    .map((upload) => upload.split('/api/asset-register/uploads/')[1] ?? '')
    .map((upload) => upload.split('?')[0]?.trim() ?? '')
    .filter(Boolean)
    .filter((upload) => {
      if (seen.has(upload)) {
        return false;
      }

      seen.add(upload);
      return true;
    });
}

export async function deleteUnreferencedAssetRegisterUploads(_input: {
  userId: string;
  uploadIds: string[];
  excludeAssetId?: string | null;
}): Promise<void> {
  return;
}

export async function createAssetRegisterSignedGetUrl(_uploadId: string): Promise<string | null> {
  return null;
}

export async function getLegacyAssetRegisterUploadResponse(
  _uploadId: string,
): Promise<LegacyAssetRegisterUploadResponse | null> {
  return null;
}
