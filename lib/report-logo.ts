import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveAssetRegisterUploadBytes } from './asset-register-uploads';
import { isAllowedReportResourceUrl } from './report-resource-policy';

const FALLBACK_REPORT_LOGO_PUBLIC_PATH = '/brand/aim4price-mark-black.png';
const ASSET_REGISTER_UPLOAD_ROUTE_PREFIX = '/api/asset-register/uploads/';

const MIME_TYPE_BY_EXTENSION = new Map<string, string>([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
]);

const cachedPublicImageDataUris = new Map<string, string | null>();
let cachedFallbackReportLogoDataUri: string | null | undefined;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeImageMimeType(value: unknown, fallbackFileName = ''): string {
  const mimeType = asText(value).toLowerCase();

  if (mimeType === 'image/jpg') return 'image/jpeg';
  if (mimeType.startsWith('image/')) return mimeType;

  const extension = path.extname(fallbackFileName).toLowerCase();
  return MIME_TYPE_BY_EXTENSION.get(extension) ?? '';
}

function isSafeDataImageUrl(value: string): boolean {
  return /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(value);
}

function buildDataUri(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function fallbackAbsoluteLogoUrl(requestUrl?: string): string {
  return requestUrl ? new URL(FALLBACK_REPORT_LOGO_PUBLIC_PATH, requestUrl).toString() : FALLBACK_REPORT_LOGO_PUBLIC_PATH;
}

function extractPathname(value: string, requestUrl?: string): string {
  const cleaned = asText(value);

  if (!cleaned) return '';

  if (cleaned.startsWith('/')) {
    return cleaned.split(/[?#]/)[0] ?? '';
  }

  const uploadRouteIndex = cleaned.indexOf(ASSET_REGISTER_UPLOAD_ROUTE_PREFIX);
  if (uploadRouteIndex >= 0) {
    return cleaned.slice(uploadRouteIndex).split(/[?#]/)[0] ?? '';
  }

  try {
    return new URL(cleaned, requestUrl || 'https://aim4price.local/').pathname;
  } catch {
    return '';
  }
}

function extractInternalAssetRegisterUploadId(value: string, requestUrl?: string): string {
  const pathname = extractPathname(value, requestUrl);

  if (!pathname.startsWith(ASSET_REGISTER_UPLOAD_ROUTE_PREFIX)) {
    return '';
  }

  const encodedUploadId = pathname.slice(ASSET_REGISTER_UPLOAD_ROUTE_PREFIX.length).split('/')[0] ?? '';

  try {
    return decodeURIComponent(encodedUploadId).trim();
  } catch {
    return encodedUploadId.trim();
  }
}

async function internalAssetRegisterUploadToDataUri(rawLogoUrl: string, requestUrl?: string): Promise<string> {
  const uploadId = extractInternalAssetRegisterUploadId(rawLogoUrl, requestUrl);

  if (!uploadId) return '';

  try {
    const uploadResult = await resolveAssetRegisterUploadBytes(uploadId);
    const upload = uploadResult.status === 'ready' ? uploadResult.upload : null;
    const mimeType = normalizeImageMimeType(upload?.mimeType, upload?.fileName);

    if (!upload?.data?.length || !mimeType) {
      return '';
    }

    return buildDataUri(upload.data, mimeType);
  } catch (error) {
    console.warn('Failed to embed asset register report logo upload.', error);
    return '';
  }
}

function normalizePublicPath(value: string, requestUrl?: string): string {
  const pathname = extractPathname(value, requestUrl);

  if (!pathname || pathname.includes('\0')) return '';
  if (!pathname.startsWith('/brand/') && pathname !== FALLBACK_REPORT_LOGO_PUBLIC_PATH) return '';

  try {
    const decoded = decodeURIComponent(pathname);
    const parts = decoded.split('/').filter(Boolean);

    if (!parts.length || parts.some((part) => part === '..' || part.includes('\0'))) {
      return '';
    }

    return `/${parts.join('/')}`;
  } catch {
    return '';
  }
}

async function publicImageToDataUri(publicPath: string, requestUrl?: string): Promise<string> {
  const normalizedPublicPath = normalizePublicPath(publicPath, requestUrl);

  if (!normalizedPublicPath) return '';

  if (cachedPublicImageDataUris.has(normalizedPublicPath)) {
    return cachedPublicImageDataUris.get(normalizedPublicPath) ?? '';
  }

  try {
    const mimeType = normalizeImageMimeType('', normalizedPublicPath);

    if (!mimeType) {
      cachedPublicImageDataUris.set(normalizedPublicPath, null);
      return '';
    }

    const relativePath = normalizedPublicPath.split('/').filter(Boolean);
    const buffer = await readFile(path.join(process.cwd(), 'public', ...relativePath));
    const dataUri = buildDataUri(buffer, mimeType);
    cachedPublicImageDataUris.set(normalizedPublicPath, dataUri);
    return dataUri;
  } catch (error) {
    console.warn('Failed to embed public report logo.', error);
    cachedPublicImageDataUris.set(normalizedPublicPath, null);
    return '';
  }
}

export async function getFallbackReportLogoUrl(requestUrl?: string): Promise<string> {
  if (cachedFallbackReportLogoDataUri) {
    return cachedFallbackReportLogoDataUri;
  }

  if (cachedFallbackReportLogoDataUri === null) {
    return fallbackAbsoluteLogoUrl(requestUrl);
  }

  const embeddedLogo = await publicImageToDataUri(FALLBACK_REPORT_LOGO_PUBLIC_PATH, requestUrl);

  if (embeddedLogo) {
    cachedFallbackReportLogoDataUri = embeddedLogo;
    return embeddedLogo;
  }

  cachedFallbackReportLogoDataUri = null;
  return fallbackAbsoluteLogoUrl(requestUrl);
}

export async function resolveReportLogoUrlForHtml(rawLogoUrl: unknown, requestUrl?: string): Promise<string> {
  const cleanedLogoUrl = asText(rawLogoUrl);
  const fallbackLogoUrl = await getFallbackReportLogoUrl(requestUrl);

  if (!cleanedLogoUrl) {
    return fallbackLogoUrl;
  }

  if (isSafeDataImageUrl(cleanedLogoUrl)) {
    return cleanedLogoUrl.replace(/\s+/g, '');
  }

  const internalUploadDataUri = await internalAssetRegisterUploadToDataUri(cleanedLogoUrl, requestUrl);

  if (internalUploadDataUri) {
    return internalUploadDataUri;
  }

  const publicDataUri = await publicImageToDataUri(cleanedLogoUrl, requestUrl);

  if (publicDataUri) {
    return publicDataUri;
  }

  if (cleanedLogoUrl.startsWith('/') && requestUrl) {
    const candidateUrl = new URL(cleanedLogoUrl, requestUrl).toString();
    return isAllowedReportResourceUrl(candidateUrl, requestUrl) ? candidateUrl : fallbackLogoUrl;
  }

  if (cleanedLogoUrl.startsWith('//')) {
    const candidateUrl = new URL(cleanedLogoUrl, requestUrl || 'https://aim4price.local/').toString();
    return isAllowedReportResourceUrl(candidateUrl, requestUrl) ? candidateUrl : fallbackLogoUrl;
  }

  if (cleanedLogoUrl.startsWith('https://') || cleanedLogoUrl.startsWith('http://')) {
    return isAllowedReportResourceUrl(cleanedLogoUrl, requestUrl) ? cleanedLogoUrl : fallbackLogoUrl;
  }

  return fallbackLogoUrl;
}

