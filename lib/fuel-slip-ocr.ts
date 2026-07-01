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

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_OCR_TEXT_LENGTH = 20000;
const TESSERACT_LANGUAGE = 'eng';

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

function maskDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return value;
  const last4 = digits.slice(-4);
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${last4}`;
}

function maskSensitiveOcrText(value: string): string {
  return String(value ?? '').replace(/\b(?:\d[\s-]?){13,19}\b/g, (match) => maskDigits(match));
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
    worker = await createLocalTesseractWorker(tesseract);

    const result = await worker.recognize(input.data, undefined, { text: true });
    const rawText = normalizeOcrText(result.data.text);

    if (!rawText.trim()) {
      return {
        rawText: '',
        warnings: ['Fuel slip photo saved, but local OCR did not return readable text. Complete the fields manually before saving.'],
      };
    }

    return {
      rawText,
      warnings: [],
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
