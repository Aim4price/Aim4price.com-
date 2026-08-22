export type ExternalShareFileKind = 'photo' | 'report' | 'document';

export type ExternalShareFileSource = {
  id: string;
  kind: ExternalShareFileKind;
  label: string;
  description: string;
  fileName: string;
  url: string;
  contentType?: string;
  credentials?: RequestCredentials;
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

export async function fetchExternalShareFile(
  source: ExternalShareFileSource,
  fetcher: typeof fetch = fetch,
): Promise<File> {
  const response = await fetcher(source.url, {
    credentials: source.credentials ?? 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Could not prepare “${source.label}”.`);
  }

  const blob = await response.blob();
  const responseType = blob.type.split(';')[0]?.trim().toLowerCase() ?? '';
  const expectedType = source.contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!blob.size) {
    throw new Error(`“${source.label}” is empty.`);
  }
  if (responseType === 'text/html' && expectedType && expectedType !== 'text/html') {
    throw new Error(`“${source.label}” returned a sign-in page instead of a file.`);
  }
  const contentType = responseType && responseType !== 'application/octet-stream'
    ? responseType
    : expectedType || 'application/octet-stream';
  const responseFileName = fileNameFromDisposition(response.headers.get('content-disposition'));
  const fileName = ensureFileExtension(responseFileName || source.fileName, contentType);

  return new File([blob], fileName, {
    type: contentType,
    lastModified: Date.now(),
  });
}

export function formatExternalShareFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC_TABLE = buildCrcTable();

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function zipDateParts(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function uniqueArchiveFileNames(files: File[]): string[] {
  const counts = new Map<string, number>();

  return files.map((file) => {
    const safeName = sanitizeFileName(file.name);
    const key = safeName.toLowerCase();
    const count = counts.get(key) ?? 0;
    counts.set(key, count + 1);
    if (!count) return safeName;

    const extensionMatch = /^(.*?)(\.[^.]+)?$/.exec(safeName);
    return `${extensionMatch?.[1] || safeName} (${count + 1})${extensionMatch?.[2] || ''}`;
  });
}

export async function createExternalShareArchive(files: File[]): Promise<Blob> {
  if (!files.length) throw new Error('Choose at least one file to download.');

  const encoder = new TextEncoder();
  const names = uniqueArchiveFileNames(files);
  const entries = await Promise.all(files.map(async (file, index) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = encoder.encode(names[index]);
    const checksum = crc32(bytes);
    const modified = zipDateParts(new Date(file.lastModified || Date.now()));
    return { bytes, name, checksum, modified };
  }));

  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let localOffset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const localHeader = new ArrayBuffer(30);
    const localView = new DataView(localHeader);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, entry.modified.time);
    writeUint16(localView, 12, entry.modified.day);
    writeUint32(localView, 14, entry.checksum);
    writeUint32(localView, 18, entry.bytes.byteLength);
    writeUint32(localView, 22, entry.bytes.byteLength);
    writeUint16(localView, 26, entry.name.byteLength);
    writeUint16(localView, 28, 0);
    localParts.push(localHeader, entry.name, entry.bytes);

    const centralHeader = new ArrayBuffer(46);
    const centralView = new DataView(centralHeader);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, entry.modified.time);
    writeUint16(centralView, 14, entry.modified.day);
    writeUint32(centralView, 16, entry.checksum);
    writeUint32(centralView, 20, entry.bytes.byteLength);
    writeUint32(centralView, 24, entry.bytes.byteLength);
    writeUint16(centralView, 28, entry.name.byteLength);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localOffset);
    centralParts.push(centralHeader, entry.name);
    centralSize += centralHeader.byteLength + entry.name.byteLength;

    localOffset += localHeader.byteLength + entry.name.byteLength + entry.bytes.byteLength;
  }

  const end = new ArrayBuffer(22);
  const endView = new DataView(end);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, localOffset);
  writeUint16(endView, 20, 0);

  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}
