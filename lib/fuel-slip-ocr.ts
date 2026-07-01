export type FuelSlipOcrInput = {
  data: Buffer;
  contentType: string;
  fileName: string;
};

export type FuelSlipOcrResult = {
  rawText: string;
  warnings: string[];
};

const DEFAULT_OPENAI_OCR_MODEL = 'gpt-4o-mini';
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\f\v]+/g, ' ')
    .trim();
}

function maskDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return value;
  const last4 = digits.slice(-4);
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${last4}`;
}

function maskSensitiveOcrText(value: string): string {
  return value.replace(/\b(?:\d[\s-]?){13,19}\b/g, (match) => maskDigits(match));
}

function imageMimeType(input: FuelSlipOcrInput): string {
  const contentType = cleanText(input.contentType).toLowerCase();
  if (SUPPORTED_IMAGE_TYPES.has(contentType)) return contentType === 'image/jpg' ? 'image/jpeg' : contentType;

  const fileName = cleanText(input.fileName).toLowerCase();
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.webp')) return 'image/webp';

  return '';
}

function readOpenAIContent(responseJson: unknown): string {
  const root = responseJson as {
    choices?: Array<{ message?: { content?: unknown } }>;
    output_text?: unknown;
  };

  if (typeof root.output_text === 'string') {
    return root.output_text;
  }

  const content = root.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

export function isSupportedFuelSlipImage(input: { contentType: string; fileName: string }): boolean {
  return Boolean(imageMimeType({ data: Buffer.alloc(0), contentType: input.contentType, fileName: input.fileName }));
}

export async function extractFuelSlipImageText(input: FuelSlipOcrInput): Promise<FuelSlipOcrResult> {
  const apiKey = cleanText(process.env.OPENAI_API_KEY);

  if (!apiKey) {
    return {
      rawText: '',
      warnings: ['Fuel slip photo saved, but OCR is not configured yet. Complete the fields manually before saving.'],
    };
  }

  const mimeType = imageMimeType(input);

  if (!mimeType) {
    return {
      rawText: '',
      warnings: ['This image type is not supported for fuel slip OCR. Upload a JPG, JPEG, PNG or WEBP photo, or complete the fields manually.'],
    };
  }

  try {
    const model = cleanText(process.env.OPENAI_OCR_MODEL) || DEFAULT_OPENAI_OCR_MODEL;
    const imageUrl = `data:${mimeType};base64,${input.data.toString('base64')}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 2500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  'Extract readable text from this South African fuel slip photo.',
                  'Return plain text only. Keep line breaks where useful.',
                  'Include visible supplier, VAT, slip, transaction, date, time, fuel type, litres, price per litre, total, VAT, payment, masked card, merchant, terminal and site details when present.',
                  'Do not guess missing values.',
                ].join(' '),
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
      }),
    });

    const responseJson = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      const errorMessage =
        responseJson && typeof responseJson === 'object' && 'error' in responseJson
          ? cleanText((responseJson as { error?: { message?: unknown } }).error?.message)
          : '';

      return {
        rawText: '',
        warnings: [
          errorMessage
            ? `Fuel slip photo saved, but OCR could not read the photo: ${errorMessage}. Complete the fields manually before saving.`
            : 'Fuel slip photo saved, but OCR could not read the photo. Complete the fields manually before saving.',
        ],
      };
    }

    const rawText = maskSensitiveOcrText(readOpenAIContent(responseJson)).slice(0, 20000);

    if (!rawText.trim()) {
      return {
        rawText: '',
        warnings: ['Fuel slip photo saved, but OCR did not return readable text. Complete the fields manually before saving.'],
      };
    }

    return {
      rawText,
      warnings: [],
    };
  } catch {
    return {
      rawText: '',
      warnings: ['Fuel slip photo saved, but OCR failed. Complete the fields manually before saving.'],
    };
  }
}
