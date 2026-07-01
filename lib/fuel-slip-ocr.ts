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
type SharpModule = typeof import('sharp');

type OcrCandidate = {
  label: string;
  data: Buffer;
};

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_OCR_TEXT_LENGTH = 20000;
const TESSERACT_LANGUAGE = 'eng';
const ROTATION_ANGLES = [0, 90, 180, 270] as const;

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

function extractLast4FromCardLikeValue(value: string): string {
  const text = cleanText(value);
  if (!text) return '';

  const masked = /(?:\b\d{4,6}[\s-]*)?(?:[*xX]{2,}[\s-]*){1,4}(\d{4})\b/.exec(text);
  if (masked) return masked[1];

  const firstMasked = /\b\d{4,6}[\s-]*(?:[*xX]{2,}[\s-]*){1,3}(\d{4})\b/.exec(text);
  if (firstMasked) return firstMasked[1];

  const digits = text.replace(/\D/g, '');
  return digits.length >= 13 && digits.length <= 19 ? digits.slice(-4) : '';
}

function maskCardLikeMatch(value: string): string {
  const last4 = extractLast4FromCardLikeValue(value);
  return last4 ? safeCardMask(last4) : value;
}

function maskSensitiveOcrText(value: string): string {
  return String(value ?? '')
    .replace(/\b\d{4,6}[\s-]*(?:[*xX]{2,}[\s-]*){1,3}\d{4}\b/g, (match) => maskCardLikeMatch(match))
    .replace(/\b(?:[*xX]{2,}[\s-]*){1,4}\d{4}\b/g, (match) => maskCardLikeMatch(match))
    .replace(/\b(?:\d[\s-]?){13,19}\b/g, (match) => maskCardLikeMatch(match));
}

function normalizeOcrText(value: unknown): string {
  return maskSensitiveOcrText(
    String(value ?? '')
      .replace(/\r/g, '\n')
      .replace(/\u00a0/g, ' ')
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
    tessedit_pageseg_mode: tesseract.PSM.SPARSE_TEXT,
    user_defined_dpi: '300',
  });

  return worker;
}

async function buildPreprocessedOcrCandidates(input: FuelSlipOcrInput): Promise<OcrCandidate[]> {
  let sharp: SharpModule;

  try {
    sharp = await import('sharp');
  } catch {
    return [{ label: 'original', data: input.data }];
  }

  const candidates: OcrCandidate[] = [];

  try {
    const base = sharp.default(input.data, { failOn: 'none', limitInputPixels: false })
      .rotate()
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.1 });

    for (const angle of ROTATION_ANGLES) {
      const data = await base
        .clone()
        .rotate(angle)
        .png({ compressionLevel: 9 })
        .toBuffer();

      candidates.push({ label: `preprocessed-${angle}`, data });
    }
  } catch {
    return [{ label: 'original', data: input.data }];
  }

  return candidates.length ? candidates : [{ label: 'original', data: input.data }];
}

function scoreFuelSlipOcrText(text: string, confidence: number | null): number {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) return 0;

  let score = Math.min(25, Math.floor(normalized.length / 40));
  if (confidence !== null && Number.isFinite(confidence)) score += Math.max(0, Math.min(20, confidence / 5));
  if (/\b(?:litres?|liters?|ltrs?)\s*[:=]?\s*\d|\b\d[\d,.]*\s*(?:litres?|liters?)\b/.test(normalized)) score += 22;
  if (/\b(?:diesel|excellium|unleaded|petrol|d\s*50)\b/.test(normalized)) score += 14;
  if (/@\s*(?:zar\s*)?(?:r\s*)?\d|per\s*(?:litre|liter|l)/.test(normalized)) score += 12;
  if (/\b(?:total\s+amount|total|amnt|amount|purchase)\b/.test(normalized)) score += 12;
  if (/(?:zar\s*)?r\s*\d[\d\s,.]*(?:[,.]\d{2})/.test(normalized)) score += 8;
  if (/\b(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.](?:20)?\d{2}|d\s*:\s*\d{1,2}[-/.]\d{1,2}[-/.]\d{2})\b/i.test(text)) score += 12;
  if (/\b(?:engen|astron|total|courtenay|rainbow|bodorp|motors|garage|fuel)\b/.test(normalized)) score += 10;
  if (/\*{4,}\d{4}\b|\bcard\b|\bpan\b/.test(normalized)) score += 6;
  return score;
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
    const candidates = await buildPreprocessedOcrCandidates(input);
    worker = await createLocalTesseractWorker(tesseract);

    let bestText = '';
    let bestScore = -1;
    let successfulAttempts = 0;

    for (const candidate of candidates) {
      try {
        const result = await worker.recognize(candidate.data, undefined, { text: true });
        const rawText = normalizeOcrText(result.data.text);
        const confidence = typeof result.data.confidence === 'number' ? result.data.confidence : null;
        const score = scoreFuelSlipOcrText(rawText, confidence);
        successfulAttempts += 1;

        if (score > bestScore) {
          bestText = rawText;
          bestScore = score;
        }
      } catch {
        // Continue with the remaining local rotations if one candidate fails.
      }
    }

    if (!bestText.trim()) {
      return {
        rawText: '',
        warnings: ['Fuel slip photo saved, but local OCR did not return readable text. Complete the fields manually before saving.'],
      };
    }

    return {
      rawText: bestText,
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
