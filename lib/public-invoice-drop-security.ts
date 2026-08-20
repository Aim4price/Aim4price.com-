import { createHash, createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export const MAX_PUBLIC_INVOICE_FILE_BYTES = 12 * 1024 * 1024;
// The canonical Cost Ledger currently keeps one protected source document per
// invoice. Multi-page invoices should therefore be supplied as one PDF.
export const MAX_PUBLIC_INVOICE_FILES = 1;
export const MAX_PUBLIC_INVOICE_REQUEST_BYTES =
  MAX_PUBLIC_INVOICE_FILE_BYTES * MAX_PUBLIC_INVOICE_FILES + 1024 * 1024;

export const PUBLIC_INVOICE_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type PublicInvoiceMimeType = (typeof PUBLIC_INVOICE_ALLOWED_MIME_TYPES)[number];

export type ValidatedPublicInvoiceFile = {
  data: Buffer;
  byteSize: number;
  contentType: PublicInvoiceMimeType;
  fileName: string;
  pageOrder: number;
  sha256: string;
};

type PublicInvoiceClientAddressInput = {
  runtimeAddress?: string | null;
  forwardedFor?: string | null;
  production?: boolean;
  trustProxyHeaders?: boolean;
  trustedProxyHops?: number;
};

type PublicInvoiceFormDataOptions = {
  maximumBytes?: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var aim4pricePublicInvoiceRateLimits: Map<string, RateLimitEntry> | undefined;
}

const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const rateLimitStore = (global.aim4pricePublicInvoiceRateLimits ??= new Map());

function normalizedIpAddress(value: unknown): string | null {
  let normalized = String(value ?? '').trim();
  if (!normalized) return null;

  if (normalized.startsWith('[')) {
    const closingBracket = normalized.indexOf(']');
    if (closingBracket > 0) normalized = normalized.slice(1, closingBracket);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(normalized)) {
    normalized = normalized.slice(0, normalized.lastIndexOf(':'));
  }

  return isIP(normalized) ? normalized.toLowerCase() : null;
}

function configuredTrustedProxyHops(): number {
  const raw = String(process.env.PUBLIC_INVOICE_TRUSTED_PROXY_HOPS ?? '').trim();
  if (!raw) return 1;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error('PUBLIC_INVOICE_PROXY_HOPS_INVALID');
  }
  return parsed;
}

/**
 * Resolves the address used for the shared public-upload throttle. In
 * production, forwarded addresses are accepted only after the deployment has
 * explicitly declared how many trusted proxies append to X-Forwarded-For.
 * Reading from the right prevents a caller-prepended value from becoming the
 * rate-limit identity.
 */
export function resolvePublicInvoiceClientAddress(
  input: PublicInvoiceClientAddressInput,
): string {
  const production = input.production ?? process.env.NODE_ENV === 'production';
  const runtimeAddress = normalizedIpAddress(input.runtimeAddress);
  if (runtimeAddress) return runtimeAddress;

  const trustProxyHeaders = input.trustProxyHeaders
    ?? process.env.PUBLIC_INVOICE_TRUST_PROXY_HEADERS === 'YES_I_TRUST_RAILWAY_PROXY';
  if (production && !trustProxyHeaders) {
    throw new Error('PUBLIC_INVOICE_PROXY_IDENTITY_NOT_CONFIGURED');
  }

  const forwardedChain = String(input.forwardedFor ?? '')
    .split(',')
    .map(normalizedIpAddress)
    .filter((value): value is string => Boolean(value));
  const trustedProxyHops = input.trustedProxyHops ?? configuredTrustedProxyHops();
  const forwardedAddress = forwardedChain.at(-trustedProxyHops) ?? null;
  if (forwardedAddress) return forwardedAddress;

  if (!production) return 'local-development';
  throw new Error('PUBLIC_INVOICE_CLIENT_ADDRESS_UNAVAILABLE');
}

/**
 * Buffers only a strictly bounded public multipart body before asking the
 * platform FormData parser to decode it. This protects self-hosted Next.js on
 * Railway when Content-Length is absent (for example, chunked transfer).
 */
export async function readPublicInvoiceFormData(
  request: Request,
  options: PublicInvoiceFormDataOptions = {},
): Promise<FormData> {
  const maximumBytes = options.maximumBytes ?? MAX_PUBLIC_INVOICE_REQUEST_BYTES;
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new Error('PUBLIC_INVOICE_REQUEST_LIMIT_INVALID');
  }

  const contentType = String(request.headers.get('content-type') ?? '').trim();
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/(?:^|;)\s*boundary\s*=/i.test(contentType)) {
    throw new Error('PUBLIC_INVOICE_CONTENT_TYPE_INVALID');
  }

  const declaredLength = String(request.headers.get('content-length') ?? '').trim();
  if (declaredLength) {
    if (!/^\d+$/.test(declaredLength)) throw new Error('PUBLIC_INVOICE_CONTENT_LENGTH_INVALID');
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength)) throw new Error('PUBLIC_INVOICE_CONTENT_LENGTH_INVALID');
    if (parsedLength > maximumBytes) throw new Error('PUBLIC_INVOICE_REQUEST_TOO_LARGE');
  }

  if (!request.body || request.bodyUsed) throw new Error('PUBLIC_INVOICE_BODY_INVALID');
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = Buffer.from(result.value);
      totalBytes += chunk.length;
      if (totalBytes > maximumBytes) {
        await reader.cancel('PUBLIC_INVOICE_REQUEST_TOO_LARGE').catch(() => undefined);
        throw new Error('PUBLIC_INVOICE_REQUEST_TOO_LARGE');
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  if (!totalBytes) throw new Error('PUBLIC_INVOICE_BODY_INVALID');
  try {
    const boundedBody = Buffer.concat(chunks, totalBytes);
    return await new Response(new Uint8Array(boundedBody), {
      headers: { 'Content-Type': contentType },
    }).formData();
  } catch {
    throw new Error('PUBLIC_INVOICE_FORM_INVALID');
  }
}

function startsWithBytes(bytes: Uint8Array, signature: Uint8Array, offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;

  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[offset + index] !== signature[index]) return false;
  }

  return true;
}

function findBytes(bytes: Uint8Array, signature: Uint8Array, maximumStart: number): number {
  const upperBound = Math.min(maximumStart, bytes.length - signature.length);

  for (let offset = 0; offset <= upperBound; offset += 1) {
    if (startsWithBytes(bytes, signature, offset)) return offset;
  }

  return -1;
}

export function detectPublicInvoiceMime(bytes: Uint8Array): PublicInvoiceMimeType | null {
  // ISO 32000 allows a PDF header within the first 1024 bytes of the file.
  if (findBytes(bytes, PDF_SIGNATURE, 1024) >= 0) return 'application/pdf';

  if (
    bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (startsWithBytes(bytes, PNG_SIGNATURE)) return 'image/png';

  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

function extensionForMime(mimeType: PublicInvoiceMimeType): string {
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  return '.webp';
}

export function sanitizePublicInvoiceFileName(
  originalName: string,
  mimeType: PublicInvoiceMimeType,
  pageOrder = 0,
): string {
  const extension = extensionForMime(mimeType);
  const normalized = String(originalName || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\\/]+/g, ' ')
    .replace(/[<>:"|?*]+/g, ' ')
    .replace(/(?:^|\s)\.{1,2}(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const withoutExtension = normalized.replace(/\.[a-z0-9]{1,8}$/i, '').trim();
  const fallback = `invoice-page-${Math.max(1, pageOrder + 1)}`;
  const baseName = (withoutExtension || fallback).slice(0, 130).trim() || fallback;

  return `${baseName}${extension}`;
}

function normalizedClaimedMime(value: string): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'image/jpg' || normalized === 'image/pjpeg') return 'image/jpeg';
  return normalized;
}

export async function validatePublicInvoiceFiles(
  files: File[],
): Promise<ValidatedPublicInvoiceFile[]> {
  if (!files.length) throw new Error('Attach the invoice before submitting.');
  if (files.length > MAX_PUBLIC_INVOICE_FILES) {
    throw new Error('Upload one invoice file at a time. Use one multi-page PDF when needed.');
  }

  const validated: ValidatedPublicInvoiceFile[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];

    if (!file.size) throw new Error('One of the selected files is empty.');
    if (file.size > MAX_PUBLIC_INVOICE_FILE_BYTES) {
      throw new Error('Each invoice file must be 12 MB or smaller.');
    }

    const data = Buffer.from(await file.arrayBuffer());

    if (data.length !== file.size || data.length > MAX_PUBLIC_INVOICE_FILE_BYTES) {
      throw new Error('The uploaded file size could not be verified.');
    }

    const detectedMime = detectPublicInvoiceMime(data);

    if (!detectedMime) {
      throw new Error('Only genuine PDF, JPG, PNG and WEBP files are accepted.');
    }

    const claimedMime = normalizedClaimedMime(file.type);

    if (claimedMime && claimedMime !== detectedMime) {
      throw new Error('A selected file does not match its reported file type.');
    }

    validated.push({
      data,
      byteSize: data.length,
      contentType: detectedMime,
      fileName: sanitizePublicInvoiceFileName(file.name, detectedMime, index),
      pageOrder: index,
      sha256: createHash('sha256').update(data).digest('hex'),
    });
  }

  return validated;
}

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(String(value || '').trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function configuredPublicInvoiceOrigins(): string[] {
  const values = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.BETTER_AUTH_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.AIM4PRICE_PUBLIC_INVOICE_ORIGINS,
    'https://aim4price.com',
    'https://www.aim4price.com',
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(','))
    .map((value) => (/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`))
    .map(normalizeOrigin)
    .filter((value): value is string => Boolean(value));

  if (process.env.NODE_ENV !== 'production') {
    values.push('http://localhost:3000', 'http://localhost:3001');
  }

  return Array.from(new Set(values));
}

export function isTrustedPublicInvoiceOrigin(input: {
  originHeader: string | null;
  secFetchSite: string | null;
  requestOrigin: string;
  allowedOrigins?: string[];
  production?: boolean;
}): boolean {
  const production = input.production ?? process.env.NODE_ENV === 'production';
  const origin = input.originHeader ? normalizeOrigin(input.originHeader) : null;
  const requestOrigin = normalizeOrigin(input.requestOrigin);
  const allowedOrigins = (input.allowedOrigins ?? configuredPublicInvoiceOrigins())
    .map(normalizeOrigin)
    .filter((value): value is string => Boolean(value));

  if (requestOrigin && (!production || allowedOrigins.includes(requestOrigin))) {
    allowedOrigins.push(requestOrigin);
  }

  if (origin) return allowedOrigins.includes(origin);

  // Some non-browser clients omit Origin. Browser submissions still provide
  // Sec-Fetch-Site, which lets same-origin requests pass without opening CORS.
  if (input.secFetchSite === 'same-origin') return true;

  return !production;
}

export function createPublicInvoiceRateLimitKey(input: {
  ipAddress: string;
  userAgent?: string | null;
}): string {
  const configuredSecret = String(process.env.PUBLIC_INVOICE_RATE_LIMIT_SECRET || '').trim();
  if (configuredSecret.length < 32 && process.env.NODE_ENV === 'production') {
    throw new Error('PUBLIC_INVOICE_RATE_LIMIT_SECRET_MISSING');
  }
  const secret = configuredSecret || 'aim4price-public-invoice-local-only';
  const ipAddress = String(input.ipAddress || 'unknown').trim().slice(0, 200);

  // Throttle by connection rather than user agent so rotating browser strings
  // cannot multiply the allowance. Only the HMAC is retained in memory.
  return createHmac('sha256', secret).update(ipAddress).digest('hex');
}

export function checkPublicInvoiceRateLimit(
  key: string,
  options: { now?: number; limit?: number; windowMs?: number } = {},
): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
  const now = options.now ?? Date.now();
  const limit = Math.max(1, options.limit ?? 8);
  const windowMs = Math.max(10_000, options.windowMs ?? 15 * 60 * 1000);

  if (rateLimitStore.size > 5_000) {
    for (const [storedKey, entry] of rateLimitStore) {
      if (entry.resetAt <= now) rateLimitStore.delete(storedKey);
    }

    // Keep a local-process fallback bounded even during a burst of distinct
    // addresses. Production can replace this hook with a shared rate store.
    while (rateLimitStore.size > 4_500) {
      const oldestKey = rateLimitStore.keys().next().value as string | undefined;
      if (!oldestKey) break;
      rateLimitStore.delete(oldestKey);
    }
  }

  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0, remaining: limit - 1 };
  }

  current.count += 1;

  if (current.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  return { allowed: true, retryAfterSeconds: 0, remaining: limit - current.count };
}

export function isPlausiblePublicInvoiceFormTiming(startedAt: string, now = Date.now()): boolean {
  const parsed = Number(startedAt);
  if (!Number.isFinite(parsed)) return false;
  const elapsed = now - parsed;
  return elapsed >= 600 && elapsed <= 24 * 60 * 60 * 1000;
}
