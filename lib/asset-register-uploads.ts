import { randomUUID } from 'node:crypto';

export const MAX_ASSET_REGISTER_PHOTOS = 12;
export const MAX_ASSET_REGISTER_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_ASSET_REGISTER_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
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
  return trimmed || 'asset-register-image';
}

function normalizeUploadId(value: string): string {
  return String(value ?? '').trim();
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

export function listInternalAssetRegisterUploadIds(photos: string[]): string[] {
  const seen = new Set<string>();

  return photos
    .map((photo) => String(photo ?? '').trim())
    .filter((photo) => photo.startsWith('/api/asset-register/uploads/'))
    .map((photo) => photo.split('/api/asset-register/uploads/')[1] ?? '')
    .map((photo) => photo.split('?')[0]?.trim() ?? '')
    .filter(Boolean)
    .filter((photo) => {
      if (seen.has(photo)) {
        return false;
      }

      seen.add(photo);
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
