import { deflateSync, inflateSync } from "zlib";
import { NextRequest, NextResponse } from "next/server";
import { isAim4priceAdminEmail } from "../../../../../../lib/account-constants";
import { findAdminUserEmail } from "../../../../../../lib/admin-users";
import { ensureAssetRegisterTables } from "../../../../../../lib/asset-registers";
import { getAnyServerSession } from "../../../../../../lib/auth-session";
import { getDb } from "../../../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QrLabelLayout = "full-labels-10-per-page" | "small-qr-25mm";

type AdminQrAssetRow = {
  id: string | number;
  title: string | null;
  plate_label: string | null;
  public_asset_code: string | null;
  kind: string | null;
  register_id: string | null;
  register_name: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
};

type AdminQrLabelAsset = {
  id: string;
  title: string;
  plateLabel: string;
  publicAssetCode: string;
  kind: string;
  registerId: string;
  registerName: string;
  hasQr: boolean;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

type DecodedPng = {
  width: number;
  height: number;
  rgb: Buffer;
};

type PreparedQrLabel = AdminQrLabelAsset & {
  imageObjectId: number;
  imageWidth: number;
  imageHeight: number;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const POINTS_PER_MM = 72 / 25.4;
const MAX_QR_ASSETS_PER_PDF = 300;

const QR_LAYOUT_LABELS: Record<QrLabelLayout, string> = {
  "full-labels-10-per-page": "10 full labels per page",
  "small-qr-25mm": "Small 25mm QR labels",
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function slugifyFileSegment(value: string): string {
  const normalized = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "qr-labels";
}

function mm(value: number): number {
  return value * POINTS_PER_MM;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}

function normalizeLayout(value: unknown): QrLabelLayout {
  const layout = cleanText(value).toLowerCase();

  if (layout === "small-qr-25mm") {
    return "small-qr-25mm";
  }

  return "full-labels-10-per-page";
}

function normalizeAssetIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const ids: string[] = [];

  for (const entry of value) {
    const id = cleanText(entry);

    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    ids.push(id);

    if (ids.length >= MAX_QR_ASSETS_PER_PDF) {
      break;
    }
  }

  return ids;
}

async function requireQrLabelSession(userId: string) {
  const session = await getAnyServerSession();

  if (!session?.user?.id) {
    return { session: null, response: jsonError("Not authenticated.", 401) };
  }

  if (!isAim4priceAdminEmail(session.user.email) && session.user.id !== userId) {
    return {
      session: null,
      response: jsonError("You can only generate QR labels for your own account.", 403),
    };
  }

  return { session, response: null };
}

function mapAdminQrAssetRow(row: AdminQrAssetRow): AdminQrLabelAsset {
  const title = cleanText(row.title) || "Untitled asset";
  const publicAssetCode = cleanText(row.public_asset_code);
  const plateLabel = cleanText(row.plate_label) || publicAssetCode;

  return {
    id: String(row.id ?? ""),
    title,
    plateLabel,
    publicAssetCode,
    kind: cleanText(row.kind),
    registerId: cleanText(row.register_id),
    registerName: cleanText(row.register_name) || "Asset Register",
    hasQr: Boolean(publicAssetCode),
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

async function listAdminQrLabelAssets(userId: string, registerId = ""): Promise<AdminQrLabelAsset[]> {
  await ensureAssetRegisterTables();

  const db = getDb();
  const result = await db.query<AdminQrAssetRow>(
    `
      select
        ari.id::text as id,
        coalesce(nullif(ari.title, ''), nullif(trim(concat_ws(' ', ari.brand_name, ari.model_name)), ''), 'Untitled asset') as title,
        ari.plate_label,
        ari.public_asset_code,
        ari.kind,
        ari.register_id::text as register_id,
        coalesce(nullif(ar.business_name, ''), 'Asset Register') as register_name,
        ari.created_at,
        ari.updated_at
      from public.asset_register_items ari
      left join public.asset_registers ar
        on ar.id = ari.register_id
       and ar.user_id = ari.user_id
      where ari.user_id = $1
        and ($2::text = '' or ari.register_id::text = $2)
        and coalesce(nullif(ari.qr_status, ''), 'active') <> 'deleted'
      order by lower(coalesce(nullif(ari.title, ''), nullif(trim(concat_ws(' ', ari.brand_name, ari.model_name)), ''), 'untitled asset')) asc,
               ari.created_at desc nulls last,
               ari.id desc
    `,
    [userId, cleanText(registerId)],
  );

  return result.rows.map(mapAdminQrAssetRow).filter((asset) => asset.id);
}

function asTextHeader(value?: string | null): string {
  return cleanText(value);
}

function normalizeOriginCandidate(value?: string | null): string | null {
  const text = asTextHeader(value);

  if (!text) {
    return null;
  }

  try {
    const url = text.includes("://") ? new URL(text) : new URL(`https://${text}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function isInternalRuntimeHost(value?: string | null): boolean {
  const text = asTextHeader(value).toLowerCase();

  return (
    text === "0.0.0.0:8080" ||
    text === "0.0.0.0" ||
    text === "127.0.0.1:8080" ||
    text === "127.0.0.1" ||
    text === "localhost:8080"
  );
}

function isLocalHost(value?: string | null): boolean {
  const text = asTextHeader(value).toLowerCase();
  return text.startsWith("localhost") || text.startsWith("127.0.0.1") || text.startsWith("0.0.0.0");
}

function resolvePublicOrigin(request: NextRequest): string {
  const forwardedHost = asTextHeader(request.headers.get("x-forwarded-host")).split(",")[0]?.trim() ?? "";
  const forwardedProto = asTextHeader(request.headers.get("x-forwarded-proto")).split(",")[0]?.trim() ?? "";

  if (forwardedHost && !isInternalRuntimeHost(forwardedHost)) {
    const forwardedOrigin = normalizeOriginCandidate(`${forwardedProto || "https"}://${forwardedHost}`);

    if (forwardedOrigin) {
      return forwardedOrigin;
    }
  }

  const envOrigin =
    normalizeOriginCandidate(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeOriginCandidate(process.env.APP_URL) ||
    normalizeOriginCandidate(process.env.BETTER_AUTH_URL) ||
    normalizeOriginCandidate(
      process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "",
    );

  if (envOrigin) {
    return envOrigin;
  }

  const host = asTextHeader(request.headers.get("host")).split(",")[0]?.trim() ?? "";

  if (host && !isInternalRuntimeHost(host)) {
    const scheme = forwardedProto || (isLocalHost(host) ? "http" : "https");
    const hostOrigin = normalizeOriginCandidate(`${scheme}://${host}`);

    if (hostOrigin) {
      return hostOrigin;
    }
  }

  const requestOrigin = normalizeOriginCandidate(request.nextUrl.origin);

  if (requestOrigin) {
    try {
      const requestHost = new URL(requestOrigin).host;

      if (!isInternalRuntimeHost(requestHost)) {
        return requestOrigin;
      }
    } catch {
      // Fall through to the production fallback.
    }
  }

  return "https://aim4pricecom-production.up.railway.app";
}

function buildScanUrl(origin: string, publicAssetCode: string): string {
  return new URL(`/scan/${encodeURIComponent(publicAssetCode)}`, origin).toString();
}

function buildExternalQrImageUrl(scanUrl: string, size: number): string {
  const url = new URL("https://api.qrserver.com/v1/create-qr-code/");
  url.searchParams.set("data", scanUrl);
  url.searchParams.set("size", `${size}x${size}`);
  url.searchParams.set("format", "png");
  url.searchParams.set("margin", "12");
  url.searchParams.set("color", "000000");
  url.searchParams.set("bgcolor", "FFFFFF");
  return url.toString();
}

async function fetchQrPngBuffer(scanUrl: string, size: number): Promise<Buffer> {
  const qrResponse = await fetch(buildExternalQrImageUrl(scanUrl, size), { cache: "no-store" });

  if (!qrResponse.ok) {
    throw new Error(`QR render service returned ${qrResponse.status}.`);
  }

  return Buffer.from(await qrResponse.arrayBuffer());
}

function readPackedSample(line: Buffer, sampleIndex: number, bitDepth: number): number {
  if (bitDepth === 8) {
    return line[sampleIndex] ?? 0;
  }

  if (bitDepth === 16) {
    return line.readUInt16BE(sampleIndex * 2);
  }

  const samplesPerByte = Math.floor(8 / bitDepth);
  const byte = line[Math.floor(sampleIndex / samplesPerByte)] ?? 0;
  const indexInsideByte = sampleIndex % samplesPerByte;
  const shift = 8 - bitDepth * (indexInsideByte + 1);
  const mask = (1 << bitDepth) - 1;
  return (byte >> shift) & mask;
}

function scaleSample(value: number, bitDepth: number): number {
  if (bitDepth === 8) {
    return value;
  }

  if (bitDepth === 16) {
    return value >> 8;
  }

  const max = (1 << bitDepth) - 1;
  return Math.round((value / max) * 255);
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);

  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
  if (distanceUp <= distanceUpLeft) return up;
  return upLeft;
}

function channelsForColorType(colorType: number): number {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 3) return 1;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;

  throw new Error(`Unsupported PNG color type ${colorType}.`);
}

function decodePngToRgb(buffer: Buffer): DecodedPng {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  if (buffer.length < signature.length || !buffer.subarray(0, signature.length).equals(signature)) {
    throw new Error("QR image was not a valid PNG file.");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  let palette: Buffer | null = null;
  const idatChunks: Buffer[] = [];

  while (offset + 12 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkType = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;

    if (dataEnd + 4 > buffer.length) {
      throw new Error("QR PNG chunk data was incomplete.");
    }

    const chunkData = buffer.subarray(dataStart, dataEnd);

    if (chunkType === "IHDR") {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8] ?? 0;
      colorType = chunkData[9] ?? 0;
      interlaceMethod = chunkData[12] ?? 0;
    } else if (chunkType === "PLTE") {
      palette = Buffer.from(chunkData);
    } else if (chunkType === "IDAT") {
      idatChunks.push(Buffer.from(chunkData));
    } else if (chunkType === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!width || !height || !bitDepth || !idatChunks.length) {
    throw new Error("QR PNG did not contain renderable image data.");
  }

  if (interlaceMethod !== 0) {
    throw new Error("Interlaced QR PNG files are not supported.");
  }

  const channels = channelsForColorType(colorType);
  const bitsPerPixel = channels * bitDepth;
  const bytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const scanlineLength = Math.ceil((width * bitsPerPixel) / 8);
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const unfiltered = Buffer.alloc(scanlineLength * height);

  let inputOffset = 0;
  let previousLine = Buffer.alloc(scanlineLength);

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;

    const filteredLine = inflated.subarray(inputOffset, inputOffset + scanlineLength);
    inputOffset += scanlineLength;

    if (filteredLine.length !== scanlineLength) {
      throw new Error("QR PNG scanline data was incomplete.");
    }

    const outputLine = Buffer.alloc(scanlineLength);

    for (let i = 0; i < scanlineLength; i += 1) {
      const raw = filteredLine[i] ?? 0;
      const left = i >= bytesPerPixel ? outputLine[i - bytesPerPixel] ?? 0 : 0;
      const up = previousLine[i] ?? 0;
      const upLeft = i >= bytesPerPixel ? previousLine[i - bytesPerPixel] ?? 0 : 0;
      let value = raw;

      if (filterType === 1) {
        value = raw + left;
      } else if (filterType === 2) {
        value = raw + up;
      } else if (filterType === 3) {
        value = raw + Math.floor((left + up) / 2);
      } else if (filterType === 4) {
        value = raw + paethPredictor(left, up, upLeft);
      } else if (filterType !== 0) {
        throw new Error(`Unsupported QR PNG filter ${filterType}.`);
      }

      outputLine[i] = value & 0xff;
    }

    outputLine.copy(unfiltered, y * scanlineLength);
    previousLine = outputLine;
  }

  const rgb = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    const line = unfiltered.subarray(y * scanlineLength, (y + 1) * scanlineLength);

    for (let x = 0; x < width; x += 1) {
      let red = 255;
      let green = 255;
      let blue = 255;

      if (colorType === 0) {
        const sample = scaleSample(readPackedSample(line, x, bitDepth), bitDepth);
        red = sample;
        green = sample;
        blue = sample;
      } else if (colorType === 2) {
        const sampleBase = x * channels * (bitDepth / 8);
        if (bitDepth === 16) {
          red = line[sampleBase] ?? 0;
          green = line[sampleBase + 2] ?? 0;
          blue = line[sampleBase + 4] ?? 0;
        } else {
          red = line[sampleBase] ?? 0;
          green = line[sampleBase + 1] ?? 0;
          blue = line[sampleBase + 2] ?? 0;
        }
      } else if (colorType === 3) {
        if (!palette) {
          throw new Error("Palette QR PNG did not include a palette.");
        }

        const paletteIndex = readPackedSample(line, x, bitDepth);
        const paletteBase = paletteIndex * 3;
        red = palette[paletteBase] ?? 255;
        green = palette[paletteBase + 1] ?? 255;
        blue = palette[paletteBase + 2] ?? 255;
      } else if (colorType === 4) {
        const sampleBase = x * channels * (bitDepth / 8);
        const gray = bitDepth === 16 ? line[sampleBase] ?? 0 : line[sampleBase] ?? 0;
        const alpha = bitDepth === 16 ? line[sampleBase + 2] ?? 255 : line[sampleBase + 1] ?? 255;
        red = Math.round(gray * (alpha / 255) + 255 * (1 - alpha / 255));
        green = red;
        blue = red;
      } else if (colorType === 6) {
        const sampleBase = x * channels * (bitDepth / 8);
        const alphaOffset = bitDepth === 16 ? 6 : 3;
        const alpha = line[sampleBase + alphaOffset] ?? 255;
        const ratio = alpha / 255;
        const rawRed = line[sampleBase] ?? 0;
        const rawGreen = bitDepth === 16 ? line[sampleBase + 2] ?? 0 : line[sampleBase + 1] ?? 0;
        const rawBlue = bitDepth === 16 ? line[sampleBase + 4] ?? 0 : line[sampleBase + 2] ?? 0;
        red = Math.round(rawRed * ratio + 255 * (1 - ratio));
        green = Math.round(rawGreen * ratio + 255 * (1 - ratio));
        blue = Math.round(rawBlue * ratio + 255 * (1 - ratio));
      } else {
        assertNever(colorType as never);
      }

      const outputBase = (y * width + x) * 3;
      rgb[outputBase] = red;
      rgb[outputBase + 1] = green;
      rgb[outputBase + 2] = blue;
    }
  }

  return { width, height, rgb };
}

class PdfDocumentBuilder {
  private objects: Array<Buffer | null> = [null];

  reserveObject(): number {
    this.objects.push(null);
    return this.objects.length - 1;
  }

  addObject(content: string | Buffer): number {
    const id = this.reserveObject();
    this.setObject(id, content);
    return id;
  }

  setObject(id: number, content: string | Buffer): void {
    this.objects[id] = Buffer.isBuffer(content) ? content : Buffer.from(content, "binary");
  }

  addStream(dictionaryBody: string, stream: Buffer): number {
    const header = Buffer.from(`<< ${dictionaryBody} /Length ${stream.length} >>\nstream\n`, "binary");
    const footer = Buffer.from("\nendstream", "binary");
    return this.addObject(Buffer.concat([header, stream, footer]));
  }

  build(rootObjectId: number): Buffer {
    const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
    const offsets = [0];
    let position = chunks[0].length;

    for (let id = 1; id < this.objects.length; id += 1) {
      const object = this.objects[id];

      if (!object) {
        throw new Error(`PDF object ${id} was reserved but never written.`);
      }

      offsets[id] = position;
      const prefix = Buffer.from(`${id} 0 obj\n`, "binary");
      const suffix = Buffer.from("\nendobj\n", "binary");
      chunks.push(prefix, object, suffix);
      position += prefix.length + object.length + suffix.length;
    }

    const xrefOffset = position;
    let xref = `xref\n0 ${this.objects.length}\n0000000000 65535 f \n`;

    for (let id = 1; id < this.objects.length; id += 1) {
      xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    }

    xref += `trailer\n<< /Size ${this.objects.length} /Root ${rootObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, "binary"));

    return Buffer.concat(chunks);
  }
}

function pdfText(value: string): string {
  const normalized = cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, " ");

  return normalized.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function truncateText(value: string, maxWidth: number, fontSize: number, weight: "regular" | "bold" = "regular"): string {
  const text = cleanText(value);
  const averageCharacterWidth = fontSize * (weight === "bold" ? 0.58 : 0.53);
  const maxCharacters = Math.max(4, Math.floor(maxWidth / averageCharacterWidth));

  if (text.length <= maxCharacters) {
    return text;
  }

  return `${text.slice(0, Math.max(1, maxCharacters - 3)).trimEnd()}...`;
}

function textLine(options: {
  x: number;
  y: number;
  text: string;
  size: number;
  font: "F1" | "F2";
  color?: [number, number, number];
}): string {
  const [red, green, blue] = options.color ?? [0.07, 0.18, 0.15];

  return [
    "BT",
    `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)} rg`,
    `/${options.font} ${options.size.toFixed(2)} Tf`,
    `1 0 0 1 ${options.x.toFixed(2)} ${options.y.toFixed(2)} Tm`,
    `(${pdfText(options.text)}) Tj`,
    "ET",
  ].join("\n");
}

function roundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const right = x + width;
  const top = y + height;
  const curve = radius * 0.5522847498;

  return [
    `${(x + radius).toFixed(2)} ${y.toFixed(2)} m`,
    `${(right - radius).toFixed(2)} ${y.toFixed(2)} l`,
    `${(right - radius + curve).toFixed(2)} ${y.toFixed(2)} ${right.toFixed(2)} ${(y + radius - curve).toFixed(2)} ${right.toFixed(2)} ${(y + radius).toFixed(2)} c`,
    `${right.toFixed(2)} ${(top - radius).toFixed(2)} l`,
    `${right.toFixed(2)} ${(top - radius + curve).toFixed(2)} ${(right - radius + curve).toFixed(2)} ${top.toFixed(2)} ${(right - radius).toFixed(2)} ${top.toFixed(2)} c`,
    `${(x + radius).toFixed(2)} ${top.toFixed(2)} l`,
    `${(x + radius - curve).toFixed(2)} ${top.toFixed(2)} ${x.toFixed(2)} ${(top - radius + curve).toFixed(2)} ${x.toFixed(2)} ${(top - radius).toFixed(2)} c`,
    `${x.toFixed(2)} ${(y + radius).toFixed(2)} l`,
    `${x.toFixed(2)} ${(y + radius - curve).toFixed(2)} ${(x + radius - curve).toFixed(2)} ${y.toFixed(2)} ${(x + radius).toFixed(2)} ${y.toFixed(2)} c`,
    "h",
  ].join("\n");
}

function drawRoundedBox(options: {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fill?: [number, number, number];
  stroke?: [number, number, number];
  lineWidth?: number;
}): string {
  const commands: string[] = ["q"];

  if (options.fill) {
    commands.push(`${options.fill[0].toFixed(3)} ${options.fill[1].toFixed(3)} ${options.fill[2].toFixed(3)} rg`);
  }

  if (options.stroke) {
    commands.push(`${options.stroke[0].toFixed(3)} ${options.stroke[1].toFixed(3)} ${options.stroke[2].toFixed(3)} RG`);
  }

  commands.push(`${(options.lineWidth ?? 0.7).toFixed(2)} w`);
  commands.push(roundedRectPath(options.x, options.y, options.width, options.height, options.radius));
  commands.push(options.fill && options.stroke ? "B" : options.fill ? "f" : "S");
  commands.push("Q");

  return commands.join("\n");
}

function drawImage(imageName: string, x: number, y: number, width: number, height: number): string {
  return [
    "q",
    `${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`,
    `/${imageName} Do`,
    "Q",
  ].join("\n");
}

function drawFullLabel(asset: PreparedQrLabel, imageName: string, x: number, y: number, width: number, height: number): string {
  const padding = mm(3.8);
  const qrSize = mm(31);
  const qrX = x + padding;
  const qrY = y + (height - qrSize) / 2;
  const copyX = qrX + qrSize + mm(4.6);
  const copyWidth = x + width - copyX - padding;
  const title = truncateText(asset.title, copyWidth, 10.6, "bold");
  const plate = truncateText(asset.plateLabel || asset.publicAssetCode, copyWidth - mm(18), 9.4, "bold");
  const code = truncateText(asset.publicAssetCode, copyWidth, 4.2, "regular");
  const top = y + height;
  const plateY = top - mm(24);

  return [
    drawRoundedBox({
      x,
      y,
      width,
      height,
      radius: mm(4.4),
      fill: [1, 1, 1],
      stroke: [0.82, 0.88, 0.84],
      lineWidth: 0.72,
    }),
    drawRoundedBox({
      x: qrX - mm(1.7),
      y: qrY - mm(1.7),
      width: qrSize + mm(3.4),
      height: qrSize + mm(3.4),
      radius: mm(3.4),
      fill: [1, 1, 1],
      stroke: [0.86, 0.9, 0.87],
      lineWidth: 0.52,
    }),
    drawImage(imageName, qrX, qrY, qrSize, qrSize),
    textLine({ x: copyX, y: top - mm(11.5), text: title, size: 10.6, font: "F2", color: [0.06, 0.2, 0.16] }),
    drawRoundedBox({
      x: copyX,
      y: plateY,
      width: copyWidth,
      height: mm(9.7),
      radius: mm(3.6),
      fill: [1, 1, 1],
      stroke: [0.84, 0.89, 0.86],
      lineWidth: 0.46,
    }),
    textLine({ x: copyX + mm(3), y: plateY + mm(3.55), text: "PLATE LABEL", size: 4.9, font: "F2", color: [0.33, 0.39, 0.36] }),
    textLine({ x: copyX + mm(23), y: plateY + mm(3.1), text: plate, size: 9.1, font: "F2", color: [0.06, 0.2, 0.16] }),
    textLine({ x: copyX, y: y + mm(15.7), text: "SCAN ACCESS", size: 5.4, font: "F2", color: [0.18, 0.24, 0.22] }),
    textLine({ x: copyX, y: y + mm(10.8), text: "Scan to update hours, fuel, notes and photos.", size: 5.45, font: "F2", color: [0.16, 0.19, 0.18] }),
    textLine({ x: copyX, y: y + mm(6.3), text: "Farm PIN required.", size: 5.45, font: "F2", color: [0.16, 0.19, 0.18] }),
    textLine({ x: copyX, y: y + mm(2.7), text: code, size: 4.0, font: "F1", color: [0.4, 0.47, 0.44] }),
  ].join("\n");
}

function drawSmallLabel(asset: PreparedQrLabel, imageName: string, x: number, y: number, width: number, height: number): string {
  const qrSize = mm(25);
  const qrX = x + (width - qrSize) / 2;
  const qrY = y + mm(6.2);
  const title = truncateText(asset.title, width - mm(4), 5.45, "bold");
  const plate = truncateText(asset.plateLabel || asset.publicAssetCode, width - mm(4), 5.0, "bold");

  return [
    drawRoundedBox({
      x,
      y,
      width,
      height,
      radius: mm(2.6),
      fill: [1, 1, 1],
      stroke: [0.82, 0.88, 0.84],
      lineWidth: 0.48,
    }),
    textLine({ x: x + mm(2), y: y + height - mm(4.6), text: title, size: 5.45, font: "F2", color: [0.06, 0.2, 0.16] }),
    drawImage(imageName, qrX, qrY, qrSize, qrSize),
    textLine({ x: x + mm(2), y: y + mm(2.7), text: plate, size: 5.0, font: "F2", color: [0.15, 0.21, 0.19] }),
  ].join("\n");
}

function buildPageContent(layout: QrLabelLayout, assets: PreparedQrLabel[]): string {
  const commands: string[] = [];

  if (layout === "full-labels-10-per-page") {
    const margin = mm(8);
    const gutterX = mm(3.5);
    const gutterY = mm(3);
    const labelWidth = (A4_WIDTH - margin * 2 - gutterX) / 2;
    const labelHeight = (A4_HEIGHT - margin * 2 - gutterY * 4) / 5;

    assets.forEach((asset, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + column * (labelWidth + gutterX);
      const top = A4_HEIGHT - margin - row * (labelHeight + gutterY);
      const y = top - labelHeight;
      commands.push(drawFullLabel(asset, `Im${index + 1}`, x, y, labelWidth, labelHeight));
    });

    return commands.join("\n");
  }

  if (layout === "small-qr-25mm") {
    const margin = mm(8);
    const gutterX = mm(3);
    const gutterY = mm(3);
    const columns = 5;
    const rows = 7;
    const labelWidth = (A4_WIDTH - margin * 2 - gutterX * (columns - 1)) / columns;
    const labelHeight = (A4_HEIGHT - margin * 2 - gutterY * (rows - 1)) / rows;

    assets.forEach((asset, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = margin + column * (labelWidth + gutterX);
      const top = A4_HEIGHT - margin - row * (labelHeight + gutterY);
      const y = top - labelHeight;
      commands.push(drawSmallLabel(asset, `Im${index + 1}`, x, y, labelWidth, labelHeight));
    });

    return commands.join("\n");
  }

  return assertNever(layout);
}

function labelsPerPage(layout: QrLabelLayout): number {
  if (layout === "full-labels-10-per-page") return 10;
  if (layout === "small-qr-25mm") return 35;
  return assertNever(layout);
}

function addPngImageObject(pdf: PdfDocumentBuilder, pngBuffer: Buffer): { objectId: number; width: number; height: number } {
  const decoded = decodePngToRgb(pngBuffer);
  const compressedRgb = deflateSync(decoded.rgb, { level: 9 });
  const objectId = pdf.addStream(
    `/Type /XObject /Subtype /Image /Width ${decoded.width} /Height ${decoded.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`,
    compressedRgb,
  );

  return { objectId, width: decoded.width, height: decoded.height };
}

async function prepareQrLabels(options: {
  pdf: PdfDocumentBuilder;
  assets: AdminQrLabelAsset[];
  origin: string;
  imageSize: number;
}): Promise<PreparedQrLabel[]> {
  const prepared: PreparedQrLabel[] = [];

  for (const asset of options.assets) {
    const scanUrl = buildScanUrl(options.origin, asset.publicAssetCode);
    const qrPng = await fetchQrPngBuffer(scanUrl, options.imageSize);
    const image = addPngImageObject(options.pdf, qrPng);

    prepared.push({
      ...asset,
      imageObjectId: image.objectId,
      imageWidth: image.width,
      imageHeight: image.height,
    });
  }

  return prepared;
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function buildQrLabelsPdf(options: {
  assets: AdminQrLabelAsset[];
  layout: QrLabelLayout;
  origin: string;
}): Promise<Buffer> {
  const pdf = new PdfDocumentBuilder();
  const pagesObjectId = pdf.reserveObject();
  const regularFontId = pdf.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = pdf.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const imageSize = options.layout === "small-qr-25mm" ? 520 : 640;
  const preparedAssets = await prepareQrLabels({
    pdf,
    assets: options.assets,
    origin: options.origin,
    imageSize,
  });
  const pageObjectIds: number[] = [];

  for (const pageAssets of chunkArray(preparedAssets, labelsPerPage(options.layout))) {
    const content = Buffer.from(buildPageContent(options.layout, pageAssets), "binary");
    const compressedContent = deflateSync(content, { level: 9 });
    const contentObjectId = pdf.addStream("/Filter /FlateDecode", compressedContent);
    const xObjects = pageAssets
      .map((asset, index) => `/Im${index + 1} ${asset.imageObjectId} 0 R`)
      .join(" ");
    const resources = `<< /ProcSet [/PDF /Text /ImageB /ImageC /ImageI] /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> /XObject << ${xObjects} >> >>`;
    const pageObjectId = pdf.addObject(
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${A4_WIDTH.toFixed(2)} ${A4_HEIGHT.toFixed(2)}] /Resources ${resources} /Contents ${contentObjectId} 0 R >>`,
    );

    pageObjectIds.push(pageObjectId);
  }

  pdf.setObject(
    pagesObjectId,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`,
  );

  const catalogObjectId = pdf.addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);
  return pdf.build(catalogObjectId);
}

export async function GET(request: NextRequest, context: { params: { userId: string } }) {
  const userId = cleanText(context.params.userId);

  if (!userId) {
    return jsonError("Missing user ID.");
  }

  const { response } = await requireQrLabelSession(userId);
  if (response) return response;

  try {
    const userEmail = await findAdminUserEmail(userId);
    const assets = await listAdminQrLabelAssets(userId, request.nextUrl.searchParams.get("registerId") ?? "");

    return NextResponse.json({
      ok: true,
      userEmail,
      assets,
    });
  } catch (error) {
    console.error("Failed to list admin QR label assets", error);
    return jsonError(error instanceof Error ? error.message : "Failed to load QR label assets.", 500);
  }
}

export async function POST(request: NextRequest, context: { params: { userId: string } }) {
  const userId = cleanText(context.params.userId);

  if (!userId) {
    return jsonError("Missing user ID.");
  }

  const { response } = await requireQrLabelSession(userId);
  if (response) return response;

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body.");
  }

  const layout = normalizeLayout(body.layout);
  const selectedAssetIds = normalizeAssetIds(body.assetIds);
  const registerId = cleanText(body.registerId);
  const fileNameBase = cleanText(body.fileNameBase);

  if (selectedAssetIds.length === 0) {
    return jsonError("Select at least one asset QR label.");
  }

  try {
    const userEmail = await findAdminUserEmail(userId);
    const allAssets = await listAdminQrLabelAssets(userId, registerId);
    const selectedIdSet = new Set(selectedAssetIds);
    const selectedAssets = allAssets.filter((asset) => selectedIdSet.has(asset.id) && asset.hasQr);

    if (selectedAssets.length === 0) {
      return jsonError("None of the selected assets have QR codes available.");
    }

    const pdfBuffer = await buildQrLabelsPdf({
      assets: selectedAssets,
      layout,
      origin: resolvePublicOrigin(request),
    });
    const fileName = `${slugifyFileSegment(fileNameBase || userEmail)}-qr-codes-${layout === "small-qr-25mm" ? "25mm" : "full-labels"}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate admin QR labels PDF", error);
    return jsonError(error instanceof Error ? error.message : "Failed to generate QR label PDF.", 500);
  }
}
