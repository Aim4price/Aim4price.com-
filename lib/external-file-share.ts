export type ExternalShareFileKind = 'photo' | 'report' | 'document';

export type ExternalShareFileRequest = {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
};

export type ExternalShareFileSource = {
  id: string;
  kind: ExternalShareFileKind;
  label: string;
  description: string;
  fileName: string;
  url: string;
  contentType?: string;
  credentials?: RequestCredentials;
  preferSourceFileName?: boolean;
  request?: ExternalShareFileRequest;
};

export type ExternalShareFileCache = {
  prepare: (source: ExternalShareFileSource) => Promise<File>;
  clear: () => void;
};

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/csv': 'csv',
  'text/plain': 'txt',
};

function sanitizeFileName(value: string, fallback = 'aim4price-file'): string {
  const normalized = String(value ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');

  return normalized || fallback;
}

function fileNameFromDisposition(value: string | null): string {
  if (!value) return '';

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/^"|"$/g, ''));
    } catch {
      // Fall through to the plain filename parser.
    }
  }

  return (/filename="([^"]+)"/i.exec(value)?.[1] || /filename=([^;]+)/i.exec(value)?.[1] || '').trim();
}

function ensureFileExtension(fileName: string, contentType: string): string {
  const safeName = sanitizeFileName(fileName);
  if (/\.[a-z0-9]{1,8}$/i.test(safeName)) return safeName;

  const normalizedType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  const extension = CONTENT_TYPE_EXTENSIONS[normalizedType];
  return extension ? `${safeName}.${extension}` : safeName;
}

async function externalShareResponseError(
  response: Response,
  source: ExternalShareFileSource,
): Promise<string> {
  const fallback = `Could not prepare “${source.label}”.`;
  if (source.kind !== 'report') return fallback;
  if (response.status === 401 || response.status === 403) {
    return 'Your Aim4price session expired. Sign in again, then retry the report.';
  }

  const responseType = String(response.headers.get('content-type') ?? '').toLowerCase();
  if (responseType.includes('application/json')) {
    const payload = await response.clone().json().catch(() => null) as { error?: unknown } | null;
    const detail = typeof payload?.error === 'string' ? payload.error.trim() : '';
    if (detail) return detail;
  }

  if (response.status === 413) return 'This report is too large to prepare on this device.';
  return fallback;
}

export async function fetchExternalShareFile(
  source: ExternalShareFileSource,
  fetcher: typeof fetch = fetch,
): Promise<File> {
  const request = source.request;
  const response = await fetcher(source.url, {
    ...(request?.method ? { method: request.method } : {}),
    ...(request?.headers ? { headers: request.headers } : {}),
    ...(typeof request?.body === 'string' ? { body: request.body } : {}),
    credentials: source.credentials ?? 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await externalShareResponseError(response, source));
  }

  const blob = await response.blob();
  const responseType = (
    response.headers.get('content-type')
    || blob.type
  ).split(';')[0]?.trim().toLowerCase() ?? '';
  const expectedType = source.contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!blob.size) {
    throw new Error(`“${source.label}” is empty.`);
  }
  if (responseType === 'text/html' && expectedType && expectedType !== 'text/html') {
    throw new Error(`“${source.label}” returned a sign-in page instead of a file.`);
  }
  if (
    source.kind === 'report'
    && expectedType
    && responseType
    && responseType !== 'application/octet-stream'
    && responseType !== expectedType
  ) {
    throw new Error(`“${source.label}” returned the wrong file type.`);
  }
  // The endpoint owns the file. Keep its MIME type and Content-Disposition
  // filename so the attachment is the same artifact as a normal report export.
  const contentType = responseType || expectedType || 'application/octet-stream';
  const responseFileName = fileNameFromDisposition(response.headers.get('content-disposition'));
  const fileName = ensureFileExtension(
    responseFileName || source.fileName,
    contentType,
  );

  return new File([blob], fileName, {
    type: contentType,
    lastModified: Date.now(),
  });
}

function externalShareFileCacheKey(source: ExternalShareFileSource): string {
  const requestHeaders = Object.entries(source.request?.headers ?? {})
    .map(([name, value]) => [name.toLowerCase(), value] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify([
    source.kind,
    source.url,
    source.fileName,
    source.contentType ?? '',
    source.credentials ?? 'include',
    source.request?.method ?? 'GET',
    requestHeaders,
    source.request?.body ?? '',
  ]);
}

/**
 * Keeps the exact File produced for a source for the lifetime of one share
 * modal. Selection changes can therefore add or remove other attachments
 * without refetching, renaming or rebuilding reports that are already ready.
 * Failed entries are evicted so the existing retry action can try them again.
 */
export function createExternalShareFileCache(
  fetcher: typeof fetch = fetch,
): ExternalShareFileCache {
  const preparedFiles = new Map<string, Promise<File>>();

  return {
    prepare(source) {
      const cacheKey = externalShareFileCacheKey(source);
      const existing = preparedFiles.get(cacheKey);
      if (existing) return existing;

      const pending = fetchExternalShareFile(source, fetcher);
      preparedFiles.set(cacheKey, pending);
      void pending.catch(() => {
        if (preparedFiles.get(cacheKey) === pending) {
          preparedFiles.delete(cacheKey);
        }
      });
      return pending;
    },
    clear() {
      preparedFiles.clear();
    },
  };
}

export function prepareExternalShareFiles(
  sources: ExternalShareFileSource[],
  cache: ExternalShareFileCache,
): Promise<File[]> {
  return Promise.all(sources.map((source) => cache.prepare(source)));
}

export function formatExternalShareFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}
