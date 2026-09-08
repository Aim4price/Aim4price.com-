const REPORT_PHOTO_LONG_EDGE = 1400;
const REPORT_PHOTO_FALLBACK_LONG_EDGE = 1000;
const REPORT_PHOTO_QUALITY = 0.82;
const REPORT_PHOTO_FALLBACK_QUALITY = 0.7;
const REPORT_PHOTO_SOFT_DATA_URL_LIMIT = 950_000;

// Temporary files belong to the current estimate, never browser storage.
let estimatePhotoFiles: File[] = [];

export function setEstimatePhotoFiles(files: readonly File[]): void {
  estimatePhotoFiles = [...files];
}

export function getEstimatePhotoFiles(): File[] {
  return [...estimatePhotoFiles];
}

function fitImage(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(1, maxEdge / Math.max(safeWidth, safeHeight));
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function renderImageToDataUrl(image: HTMLImageElement, maxEdge: number, quality: number): string {
  const size = fitImage(image.naturalWidth || image.width, image.naturalHeight || image.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image preparation is not available in this browser.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(image, 0, 0, size.width, size.height);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function compressReportPhoto(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`“${file.name}” could not be read as an image.`));
      image.src = objectUrl;
    });

    const firstPass = renderImageToDataUrl(image, REPORT_PHOTO_LONG_EDGE, REPORT_PHOTO_QUALITY);
    if (firstPass.length <= REPORT_PHOTO_SOFT_DATA_URL_LIMIT) return firstPass;
    return renderImageToDataUrl(image, REPORT_PHOTO_FALLBACK_LONG_EDGE, REPORT_PHOTO_FALLBACK_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

