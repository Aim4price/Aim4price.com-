export const MAX_SHOWROOM_LOGO_BYTES = 2_000_000;
export const MAX_SHOWROOM_LOGO_DIMENSION = 4_096;

const SHOWROOM_LOGO_DATA_PATTERN = /^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i;
const PNG_SIGNATURE = '89504e470d0a1a0a';
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

type ImageDimensions = { width: number; height: number };

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validPngHeader(bytes: Buffer, dataOffset: number): boolean {
  const bitDepth = bytes[dataOffset + 8];
  const colorType = bytes[dataOffset + 9];
  const validDepths: Record<number, ReadonlySet<number>> = {
    0: new Set([1, 2, 4, 8, 16]),
    2: new Set([8, 16]),
    3: new Set([1, 2, 4, 8]),
    4: new Set([8, 16]),
    6: new Set([8, 16]),
  };
  return Boolean(validDepths[colorType]?.has(bitDepth))
    && bytes[dataOffset + 10] === 0
    && bytes[dataOffset + 11] === 0
    && (bytes[dataOffset + 12] === 0 || bytes[dataOffset + 12] === 1);
}

function pngDimensions(bytes: Buffer): ImageDimensions | null {
  if (bytes.length < 45 || bytes.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) return null;
  let offset = 8;
  let dimensions: ImageDimensions | null = null;
  let sawImageData = false;

  while (offset + 12 <= bytes.length) {
    const chunkLength = bytes.readUInt32BE(offset);
    const chunkType = bytes.toString('ascii', offset + 4, offset + 8);
    const dataOffset = offset + 8;
    const crcOffset = dataOffset + chunkLength;
    if (crcOffset + 4 > bytes.length) return null;
    if (crc32(bytes.subarray(offset + 4, crcOffset)) !== bytes.readUInt32BE(crcOffset)) return null;

    if (!dimensions) {
      if (chunkType !== 'IHDR' || chunkLength !== 13 || !validPngHeader(bytes, dataOffset)) return null;
      dimensions = {
        width: bytes.readUInt32BE(dataOffset),
        height: bytes.readUInt32BE(dataOffset + 4),
      };
    } else if (chunkType === 'IHDR') {
      return null;
    }

    if (chunkType === 'IDAT') sawImageData = true;
    if (chunkType === 'IEND') {
      return chunkLength === 0 && sawImageData && crcOffset + 4 === bytes.length
        ? dimensions
        : null;
    }
    offset = crcOffset + 4;
  }

  return null;
}

function jpegDimensions(bytes: Buffer): ImageDimensions | null {
  if (
    bytes.length < 10
    || bytes[0] !== 0xff
    || bytes[1] !== 0xd8
    || bytes[bytes.length - 2] !== 0xff
    || bytes[bytes.length - 1] !== 0xd9
  ) return null;

  let offset = 2;
  let dimensions: ImageDimensions | null = null;
  while (offset + 3 < bytes.length - 2) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) return null;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) return null;
      dimensions = {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    if (marker === 0xda) return dimensions;
    offset += segmentLength;
  }

  return null;
}

function webpDimensions(bytes: Buffer): ImageDimensions | null {
  if (
    bytes.length < 30
    || bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WEBP'
    || bytes.readUInt32LE(4) + 8 !== bytes.length
  ) return null;

  let offset = 12;
  let canvasDimensions: ImageDimensions | null = null;
  let imageDimensions: ImageDimensions | null = null;
  while (offset + 8 <= bytes.length) {
    const chunkType = bytes.toString('ascii', offset, offset + 4);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > bytes.length) return null;

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      canvasDimensions = {
        width: bytes.readUIntLE(dataOffset + 4, 3) + 1,
        height: bytes.readUIntLE(dataOffset + 7, 3) + 1,
      };
    } else if (
      chunkType === 'VP8 '
      && chunkSize >= 10
      && bytes[dataOffset + 3] === 0x9d
      && bytes[dataOffset + 4] === 0x01
      && bytes[dataOffset + 5] === 0x2a
    ) {
      imageDimensions = {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    } else if (chunkType === 'VP8L' && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      const packed = bytes.readUInt32LE(dataOffset + 1);
      imageDimensions = {
        width: (packed & 0x3fff) + 1,
        height: ((packed >>> 14) & 0x3fff) + 1,
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  if (offset !== bytes.length || !imageDimensions) return null;
  if (
    canvasDimensions
    && (canvasDimensions.width !== imageDimensions.width || canvasDimensions.height !== imageDimensions.height)
  ) return null;
  return canvasDimensions || imageDimensions;
}

export function validateShowroomLogoDataUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length > 3_000_000) throw new Error('Keep the showroom logo below 2 MB.');
  const match = SHOWROOM_LOGO_DATA_PATTERN.exec(trimmed);
  if (!match) throw new Error('Choose a valid PNG, JPEG or WebP logo.');

  const payload = match[2];
  const bytes = Buffer.from(payload, 'base64');
  const canonicalBase64 = bytes.toString('base64');
  if (!bytes.length || canonicalBase64.replace(/=+$/, '') !== payload.replace(/=+$/, '')) {
    throw new Error('Choose a valid PNG, JPEG or WebP logo.');
  }
  if (bytes.length > MAX_SHOWROOM_LOGO_BYTES) {
    throw new Error('Keep the showroom logo below 2 MB.');
  }

  const suppliedMediaType = match[1].toLowerCase();
  const dimensions = suppliedMediaType === 'png'
    ? pngDimensions(bytes)
    : suppliedMediaType === 'webp'
      ? webpDimensions(bytes)
      : jpegDimensions(bytes);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
    throw new Error('Choose a valid PNG, JPEG or WebP logo.');
  }
  if (
    dimensions.width > MAX_SHOWROOM_LOGO_DIMENSION
    || dimensions.height > MAX_SHOWROOM_LOGO_DIMENSION
  ) {
    throw new Error('Keep the showroom logo dimensions below 4096 × 4096 pixels.');
  }

  const mediaType = suppliedMediaType === 'jpg' ? 'jpeg' : suppliedMediaType;
  return `data:image/${mediaType};base64,${canonicalBase64}`;
}
