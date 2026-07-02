import path from 'node:path';

export type FuelSlipOcrInput = {
  data: Buffer;
  contentType: string;
  fileName: string;
};

export type FuelSlipOcrResult = {
  rawText: string;
  warnings: string[];
};

type TesseractModule = typeof import('tesseract.js');
type TesseractWorker = Awaited<ReturnType<TesseractModule['createWorker']>>;
type TesseractPageSegMode = TesseractModule['PSM'][keyof TesseractModule['PSM']];
type OcrCandidate = {
  label: string;
  data: Buffer;
};

type OcrAttempt = OcrCandidate & {
  pageSegMode: TesseractPageSegMode;
};

type OcrAttemptResult = {
  label: string;
  rawText: string;
  confidence: number | null;
  score: number;
};

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_OCR_TEXT_LENGTH = 20000;
const TESSERACT_LANGUAGE = 'eng';
const CARD_MASK_CHARS = '*xX#•·●∙';
const CARD_MASK_CLASS = `[*xX#•·●∙]`;

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\f\v]+/g, ' ')
    .trim();
}

function fileExtension(fileName: string): string {
  const normalized = cleanText(fileName).toLowerCase();
  const dotIndex = normalized.lastIndexOf('.');
  return dotIndex >= 0 ? normalized.slice(dotIndex) : '';
}

function imageMimeType(input: Pick<FuelSlipOcrInput, 'contentType' | 'fileName'>): string {
  const contentType = cleanText(input.contentType).toLowerCase();
  if (SUPPORTED_IMAGE_TYPES.has(contentType)) return contentType === 'image/jpg' ? 'image/jpeg' : contentType;

  const extension = fileExtension(input.fileName);
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';

  return '';
}

function safeCardMask(last4: string): string {
  return /^\d{4}$/.test(last4) ? `************${last4}` : '';
}

function hasCardMask(value: string): boolean {
  return [...value].filter((character) => CARD_MASK_CHARS.includes(character)).length >= 2;
}

function extractLast4FromCardLikeValue(value: string): string {
  const text = cleanText(value);
  if (!text) return '';

  const maskClass = CARD_MASK_CLASS;
  const masked = new RegExp(String.raw`(?:\b\d{4,6}[\s-]*)?(?:${maskClass}{1,}[\s-]*){1,8}(\d{4})\b`).exec(text);
  if (masked) return masked[1];

  const firstMasked = new RegExp(String.raw`\b\d{4,6}[\s-]*(?:${maskClass}{1,}[\s-]*){1,6}(\d{4})\b`).exec(text);
  if (firstMasked) return firstMasked[1];

  if (hasCardMask(text)) {
    const maskedTail = /(?:[*xX#•·●∙]\s*){2,}.{0,40}?(\d{4})\b/.exec(text);
    if (maskedTail) return maskedTail[1];
  }

  const digits = text.replace(/\D/g, '');
  return digits.length >= 13 && digits.length <= 19 ? digits.slice(-4) : '';
}

function maskCardLikeMatch(value: string): string {
  const last4 = extractLast4FromCardLikeValue(value);
  return last4 ? safeCardMask(last4) : value;
}

function maskSensitiveOcrText(value: string): string {
  const maskClass = CARD_MASK_CLASS;
  return String(value ?? '')
    .replace(new RegExp(String.raw`\b\d{4,6}[\s-]*(?:${maskClass}{1,}[\s-]*){1,6}\d{4}\b`, 'g'), (match) => maskCardLikeMatch(match))
    .replace(new RegExp(String.raw`\b(?:${maskClass}{1,}[\s-]*){1,8}\d{4}\b`, 'g'), (match) => maskCardLikeMatch(match))
    .replace(/\b(?:\d[\s-]?){13,19}\b/g, (match) => maskCardLikeMatch(match));
}

function normalizeOcrText(value: unknown): string {
  return maskSensitiveOcrText(
    String(value ?? '')
      .replace(/\r/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[，]/g, ',')
      .replace(/[‐‑‒–—]/g, '-')
      .split('\n')
      .map((line) => line.replace(/[\t\f\v]+/g, ' ').replace(/[ ]{2,}/g, ' ').trim())
      .filter(Boolean)
      .join('\n'),
  ).slice(0, MAX_OCR_TEXT_LENGTH);
}

function localEnglishLanguagePath(): string {
  return path.join(process.cwd(), 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int');
}

function localTesseractCorePath(): string {
  return path.join(process.cwd(), 'node_modules', 'tesseract.js-core');
}

function localTesseractWorkerPath(): string {
  return path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');
}

export function isSupportedFuelSlipImage(input: { contentType: string; fileName: string }): boolean {
  const contentType = cleanText(input.contentType).toLowerCase();
  if (SUPPORTED_IMAGE_TYPES.has(contentType)) return true;
  return SUPPORTED_IMAGE_EXTENSIONS.has(fileExtension(input.fileName));
}

async function createLocalTesseractWorker(tesseract: TesseractModule): Promise<TesseractWorker> {
  tesseract.setLogging(false);

  const worker = await tesseract.createWorker(TESSERACT_LANGUAGE, tesseract.OEM.LSTM_ONLY, {
    corePath: localTesseractCorePath(),
    workerPath: localTesseractWorkerPath(),
    langPath: localEnglishLanguagePath(),
    cacheMethod: 'none',
    gzip: true,
    logger: () => undefined,
    errorHandler: () => undefined,
  });

  await worker.setParameters({
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });

  return worker;
}

async function buildOcrCandidates(input: FuelSlipOcrInput): Promise<OcrCandidate[]> {
  // Keep fuel-slip OCR dependency-free beyond the existing local Tesseract.js stack.
  // This avoids adding native image-processing packages that can break `npm ci` on Railway
  // when the package proxy is slow or unavailable.
  return [{ label: 'original', data: input.data }];
}

function psmValue(tesseract: TesseractModule, key: string): TesseractPageSegMode | null {
  const values = tesseract.PSM as unknown as Record<string, TesseractPageSegMode | undefined>;
  return values[key] ?? null;
}

function buildOcrAttempts(candidates: OcrCandidate[], tesseract: TesseractModule): OcrAttempt[] {
  const pageSegModes = [
    { label: 'sparse-text', value: psmValue(tesseract, 'SPARSE_TEXT') },
    { label: 'sparse-text-osd', value: psmValue(tesseract, 'SPARSE_TEXT_OSD') },
    { label: 'auto-osd', value: psmValue(tesseract, 'AUTO_OSD') },
    { label: 'auto', value: psmValue(tesseract, 'AUTO') },
    { label: 'single-column', value: psmValue(tesseract, 'SINGLE_COLUMN') },
    { label: 'single-block', value: psmValue(tesseract, 'SINGLE_BLOCK') },
  ];
  const attempts: OcrAttempt[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    for (const mode of pageSegModes) {
      if (!mode.value) continue;
      const key = `${candidate.label}:${String(mode.value)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      attempts.push({
        ...candidate,
        label: `${candidate.label}:${mode.label}`,
        pageSegMode: mode.value,
      });
    }
  }

  return attempts.length ? attempts : candidates.map((candidate) => ({ ...candidate, pageSegMode: psmValue(tesseract, 'SPARSE_TEXT') ?? tesseract.PSM.SPARSE_TEXT }));
}

function scoreFuelSlipOcrText(text: string, confidence: number | null): number {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) return 0;

  let score = Math.min(25, Math.floor(normalized.length / 40));
  if (confidence !== null && Number.isFinite(confidence)) score += Math.max(0, Math.min(20, confidence / 5));
  if (/\b(?:litres?|liters?|ltrs?|volume|qty|quantity)\s*[:=]?\s*\d|\b\d[\d,.]*\s*(?:l|litres?|liters?|ltrs?)\b/.test(normalized)) score += 24;
  if (/\b(?:diesel|petrol|unleaded|ulp|excellium|dynamic\s+diesel|v[- ]?power|fuel\s*save|quartech|turbo\s*diesel|turbodiesel|ultimate\s+diesel|bp\s+ultimate|shell\s+fuel\s*save|engen\s+dynamic|d\s*50|d\s*[- ]?50|50\s*ppm|500\s*ppm)\b/.test(normalized)) score += 18;
  if (/@\s*(?:zar\s*)?(?:r\s*)?\d|@\s*r|per\s*(?:litre|liter|l)|rate\s*\/\s*l|price\s*per|r\s*\/\s*l|c\s*\/\s*l/.test(normalized)) score += 14;
  if (/\b(?:total\s+amount|amount\s+due|total|amnt|amount|purchase|sale|card\s+tender|tender|paid)\b/.test(normalized)) score += 12;
  if (/(?:zar\s*)?r\s*\d[\d\s,.:]*(?:[,. :]\d{2})/.test(normalized)) score += 8;
  if (/\b(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.](?:20)?\d{2}|d\s*:\s*\d{1,2}[-/.]\d{1,2}[-/.]\d{2})\b/i.test(text)) score += 12;
  if (/\b(?:engen|shell|bp|totalenergies|total|astron|caltex|sasol|puma|gulf|motors?|garage|service\s+station|filling\s+station|truck\s+stop|fuel)\b/.test(normalized)) score += 10;
  if (/(?:\d{4,6}\s*)?(?:[*x#•·●∙]{1,}\s*){1,8}\d{4}\b|(?:[*x#•·●∙]{2,}\s*){1,8}\d{4}\b|\bcard\b|\bpan\b/.test(normalized)) score += 8;
  return score;
}

function uniqueLines(text: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const line of normalizeOcrText(text).split('\n')) {
    const key = line.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }

  return lines;
}

function buildCombinedOcrText(best: OcrAttemptResult, attempts: OcrAttemptResult[]): string {
  const bestLines = uniqueLines(best.rawText);
  const seen = new Set(bestLines.map((line) => line.toLowerCase().replace(/\s+/g, ' ').trim()));
  const alternateLines: string[] = [];

  for (const attempt of attempts.slice().sort((a, b) => b.score - a.score)) {
    if (attempt.label === best.label) continue;

    for (const line of uniqueLines(attempt.rawText)) {
      const key = line.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      alternateLines.push(line);
      if (alternateLines.length >= 80) break;
    }

    if (alternateLines.length >= 80) break;
  }

  const sections = [...bestLines];
  if (alternateLines.length) {
    sections.push(...alternateLines);
  }

  return normalizeOcrText(sections.join('\n'));
}

export async function extractFuelSlipImageText(input: FuelSlipOcrInput): Promise<FuelSlipOcrResult> {
  const mimeType = imageMimeType(input);

  if (!mimeType) {
    return {
      rawText: '',
      warnings: ['This image type is not supported for fuel slip OCR. Upload a JPG, JPEG, PNG or WEBP photo, or complete the fields manually.'],
    };
  }

  if (!Buffer.isBuffer(input.data) || input.data.length === 0) {
    return {
      rawText: '',
      warnings: ['Fuel slip photo saved, but no readable image data was available. Complete the fields manually before saving.'],
    };
  }

  let worker: TesseractWorker | null = null;

  try {
    const tesseract = await import('tesseract.js');
    const candidates = await buildOcrCandidates(input);
    const attempts = buildOcrAttempts(candidates, tesseract);
    worker = await createLocalTesseractWorker(tesseract);

    const results: OcrAttemptResult[] = [];
    let successfulAttempts = 0;

    for (const attempt of attempts) {
      try {
        await worker.setParameters({
          preserve_interword_spaces: '1',
          tessedit_pageseg_mode: attempt.pageSegMode,
          user_defined_dpi: '300',
        });
        const result = await worker.recognize(attempt.data, undefined, { text: true });
        const rawText = normalizeOcrText(result.data.text);
        const confidence = typeof result.data.confidence === 'number' ? result.data.confidence : null;
        const score = scoreFuelSlipOcrText(rawText, confidence);
        successfulAttempts += 1;
        results.push({ label: attempt.label, rawText, confidence, score });
      } catch {
        // Continue gracefully if local OCR fails on this OCR mode.
      }
    }

    const readableResults = results
      .filter((result) => result.rawText.trim())
      .sort((a, b) => b.score - a.score || (b.confidence ?? 0) - (a.confidence ?? 0));

    if (!readableResults.length) {
      return {
        rawText: '',
        warnings: ['Fuel slip photo saved, but local OCR did not return readable text. Complete the fields manually before saving.'],
      };
    }

    return {
      rawText: buildCombinedOcrText(readableResults[0], readableResults),
      warnings: successfulAttempts > 0 ? [] : ['Fuel slip photo saved, but local OCR had trouble reading the photo. Review and complete the fields before saving.'],
    };
  } catch {
    return {
      rawText: '',
      warnings: ['Fuel slip photo saved, but local OCR could not read the photo. Complete the fields manually before saving.'],
    };
  } finally {
    if (worker) {
      await worker.terminate().catch(() => undefined);
    }
  }
}
