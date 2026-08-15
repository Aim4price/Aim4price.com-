'use client';

import {
  AD_TEMPLATE_OPTIONS,
  DEFAULT_AD_BRAND_COLORS,
  type AdBrandSnapshot,
  type AdTemplateId,
} from './ad-studio';
import {
  calculateMarketplaceDealRating,
  type MarketplaceDealRating,
  type MarketplaceListing,
} from './marketplace';

export const MARKETPLACE_AD_WIDTH = 1600;
export const MARKETPLACE_AD_HEIGHT = 900;

export type MarketplaceAdContent = {
  title: string;
  year: string;
  usage: string;
  condition: string;
  familyLabel: string;
  askingPriceExVat: number;
  aim4priceValueExVat?: number | null;
  dealRating?: MarketplaceDealRating | null;
  sellerName: string;
  sellerPhone: string;
  sellerCompany: string;
  imageUrls: string[];
  brand: AdBrandSnapshot;
};

export type MarketplaceAdRatingPresentation = {
  value: MarketplaceDealRating;
  label: string;
  background: string;
  foreground: string;
};

type Rect = { x: number; y: number; width: number; height: number };

const RATING_PRESENTATION: Record<MarketplaceDealRating, MarketplaceAdRatingPresentation> = {
  low: { value: 'low', label: 'LOW PRICE', background: '#f97316', foreground: '#ffffff' },
  great: { value: 'great', label: 'GREAT PRICE', background: '#22b24b', foreground: '#ffffff' },
  fair: { value: 'fair', label: 'FAIR PRICE', background: '#1e9bb3', foreground: '#ffffff' },
  high: { value: 'high', label: 'HIGH PRICE', background: '#ef4444', foreground: '#ffffff' },
  none: { value: 'none', label: 'NO RATING', background: '#69788a', foreground: '#ffffff' },
};

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function money(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0).replace('ZAR', 'R');
}

function isRating(value: unknown): value is MarketplaceDealRating {
  return value === 'low' || value === 'great' || value === 'fair' || value === 'high' || value === 'none';
}

function isManualListing(listing: MarketplaceListing): boolean {
  return clean(listing.assetKind).toLowerCase().replace(/[\s_-]+/g, '-') === 'manual';
}

export function getMarketplaceAdRating(content: Pick<MarketplaceAdContent, 'dealRating' | 'askingPriceExVat' | 'aim4priceValueExVat'>): MarketplaceAdRatingPresentation {
  const rating = isRating(content.dealRating)
    ? content.dealRating
    : calculateMarketplaceDealRating({
      askingPriceExVat: content.askingPriceExVat,
      aim4priceValueExVat: content.aim4priceValueExVat,
    }).rating;
  return RATING_PRESENTATION[rating];
}

function vatLabel(brand: AdBrandSnapshot): string {
  if (brand.vatLabel === 'vat-included') return brand.language === 'af' ? 'BTW INGESLUIT' : 'VAT INCLUDED';
  if (brand.vatLabel === 'no-vat') return brand.language === 'af' ? 'GEEN BTW' : 'NO VAT';
  return brand.language === 'af' ? '+ BTW' : '+ VAT';
}

function listingImages(listing: MarketplaceListing): string[] {
  const values = [
    ...(Array.isArray(listing.imageUrls) ? listing.imageUrls : []),
    listing.imageSrc,
  ]
    .map(clean)
    .filter((value) => value && !value.endsWith('/brand/Tractor.png'));
  return Array.from(new Set(values));
}

function listingTitle(listing: MarketplaceListing): string {
  const raw = clean(listing.title) || `${clean(listing.brandName)} ${clean(listing.modelName)}`.trim();
  return raw.split(/\s*[·•]\s*/)[0] || 'Marketplace listing';
}

function listingUsage(listing: MarketplaceListing): string {
  const hours = Number(listing.hours);
  if (listing.usageUnit === 'percent') {
    const percent = Number(listing.lifeWorkedPercent);
    return Number.isFinite(percent) ? `${Math.round(percent)}% worked` : 'Usage not set';
  }
  const unit = listing.usageUnit === 'km' ? 'km' : 'hours';
  return Number.isFinite(hours) && hours > 0 ? `${Math.round(hours).toLocaleString('en-ZA')} ${unit}` : `Usage not set`;
}

export function marketplaceListingToAdContent(listing: MarketplaceListing): MarketplaceAdContent {
  const familyLabel = clean(listing.familyLabel) || clean(listing.assetKind) || 'Equipment';
  const brand = listing.adBrand ?? {
    name: 'Aim4price standard',
    templateId: 'showcase',
    logoUrl: '',
    primaryColor: DEFAULT_AD_BRAND_COLORS.primary,
    secondaryColor: DEFAULT_AD_BRAND_COLORS.secondary,
    accentColor: DEFAULT_AD_BRAND_COLORS.accent,
    businessName: clean(listing.sellerCompany) || 'Aim4price Marketplace',
    contactName: clean(listing.sellerName),
    phone: clean(listing.sellerPhone),
    email: clean(listing.sellerEmail),
    website: '',
    language: 'en',
    vatLabel: 'plus-vat',
  } satisfies AdBrandSnapshot;
  const calculatedRating = calculateMarketplaceDealRating({
    askingPriceExVat: listing.askingPriceExVat,
    aim4priceValueExVat: listing.aim4priceValueExVat,
    isManualEquipment: isManualListing(listing),
  }).rating;

  return {
    title: listingTitle(listing),
    year: clean(listing.yearModel) || 'Year not set',
    usage: listingUsage(listing),
    condition: titleCase(clean(listing.conditionLabel || listing.conditionKey) || 'Condition not set'),
    familyLabel: titleCase(familyLabel),
    askingPriceExVat: Number(listing.askingPriceExVat) || 0,
    aim4priceValueExVat: Number(listing.aim4priceValueExVat) || null,
    dealRating: isRating(listing.dealRating) ? listing.dealRating : calculatedRating,
    sellerName: clean(brand.contactName || listing.sellerName) || 'Sales contact',
    sellerPhone: clean(brand.phone || listing.sellerPhone) || '082 000 0000',
    sellerCompany: clean(brand.businessName || listing.sellerCompany) || 'Marketplace seller',
    imageUrls: listingImages(listing),
    brand,
  };
}

export function getAdTemplatePhotoCount(templateId: AdTemplateId): number {
  return AD_TEMPLATE_OPTIONS.find((option) => option.id === templateId)?.photoCount ?? 1;
}

export function resolveAdTemplateForPhotoCount(templateId: AdTemplateId, photoCount: number): AdTemplateId {
  const available = Math.max(0, Math.floor(photoCount));
  if (available >= getAdTemplatePhotoCount(templateId)) return templateId;
  if (available >= 3) return 'gallery-three';
  if (available >= 2) return 'duo-split';
  return 'photo-first';
}

function roundedPath(context: CanvasRenderingContext2D, rect: Rect, radius: number) {
  const next = Math.min(radius, rect.width / 2, rect.height / 2);
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, next);
}

function fillRounded(context: CanvasRenderingContext2D, rect: Rect, radius: number, fill: string | CanvasGradient | CanvasPattern) {
  context.save();
  roundedPath(context, rect, radius);
  context.fillStyle = fill;
  context.fill();
  context.restore();
}

function strokeRounded(context: CanvasRenderingContext2D, rect: Rect, radius: number, stroke: string, lineWidth = 2) {
  context.save();
  roundedPath(context, rect, radius);
  context.strokeStyle = stroke;
  context.lineWidth = lineWidth;
  context.stroke();
  context.restore();
}

function contrast(hexColor: string): string {
  const value = hexColor.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 148 ? '#10251f' : '#ffffff';
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let next = text;
  while (next.length > 3 && context.measureText(`${next}…`).width > maxWidth) next = next.slice(0, -1).trim();
  return `${next}…`;
}

function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, lines = 2): number {
  const words = text.split(/\s+/).filter(Boolean);
  const output: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      output.push(line);
      line = word;
      if (output.length === lines - 1) break;
    } else {
      line = candidate;
    }
  }
  if (line && output.length < lines) output.push(line);
  if (output.join(' ').length < text.length && output.length) output[output.length - 1] = fitText(context, `${output[output.length - 1]}…`, maxWidth);
  output.forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
  return y + output.length * lineHeight;
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, rect: Rect, radius: number) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return;
  const scale = Math.max(rect.width / sourceWidth, rect.height / sourceHeight);
  const cropWidth = rect.width / scale;
  const cropHeight = rect.height / scale;
  context.save();
  roundedPath(context, rect, radius);
  context.clip();
  context.drawImage(
    image,
    Math.max(0, (sourceWidth - cropWidth) / 2),
    Math.max(0, (sourceHeight - cropHeight) / 2),
    cropWidth,
    cropHeight,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
  );
  context.restore();
}

async function loadImage(source: string): Promise<HTMLImageElement | null> {
  if (!source || typeof Image === 'undefined') return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    if (!source.startsWith('data:') && !source.startsWith('blob:')) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function drawPhoto(context: CanvasRenderingContext2D, content: MarketplaceAdContent, image: HTMLImageElement | null, index: number, rect: Rect, primary: boolean) {
  context.save();
  context.shadowColor = 'rgba(9, 35, 28, 0.14)';
  context.shadowBlur = 18;
  context.shadowOffsetY = 9;
  fillRounded(context, rect, 23, '#edf2ef');
  context.restore();
  if (image) {
    drawCover(context, image, rect, 21);
  } else {
    const gradient = context.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height);
    gradient.addColorStop(0, '#eef4f1');
    gradient.addColorStop(1, '#dce8e2');
    fillRounded(context, rect, 21, gradient);
    context.save();
    context.fillStyle = '#205c48';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '850 24px Montserrat, Inter, Arial, sans-serif';
    context.fillText(`PHOTO ${index + 1}`, rect.x + rect.width / 2, rect.y + rect.height / 2 - 12);
    context.fillStyle = '#778b84';
    context.font = '700 18px Montserrat, Inter, Arial, sans-serif';
    context.fillText(fitText(context, content.familyLabel, rect.width - 54), rect.x + rect.width / 2, rect.y + rect.height / 2 + 24);
    context.restore();
  }
  strokeRounded(context, rect, 21, primary ? content.brand.primaryColor : 'rgba(255,255,255,.95)', primary ? 5 : 3);
  fillRounded(context, { x: rect.x + 14, y: rect.y + 14, width: 42, height: 42 }, 12, primary ? content.brand.primaryColor : 'rgba(255,255,255,.94)');
  context.save();
  context.fillStyle = primary ? contrast(content.brand.primaryColor) : '#122d25';
  context.font = '900 18px Montserrat, Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(index + 1), rect.x + 35, rect.y + 36);
  context.restore();
}

function drawBrand(context: CanvasRenderingContext2D, content: MarketplaceAdContent, logo: HTMLImageElement | null, rect: Rect, dark: boolean) {
  const foreground = dark ? '#ffffff' : content.brand.secondaryColor;
  if (logo) {
    const ratio = (logo.naturalWidth || logo.width) / Math.max(1, logo.naturalHeight || logo.height);
    const logoHeight = Math.min(rect.height - 24, 64);
    const logoWidth = Math.min(150, logoHeight * ratio);
    context.drawImage(logo, rect.x, rect.y + (rect.height - logoHeight) / 2, logoWidth, logoHeight);
    context.save();
    context.fillStyle = foreground;
    context.font = '850 27px Montserrat, Inter, Arial, sans-serif';
    context.textBaseline = 'middle';
    context.fillText(fitText(context, content.sellerCompany, rect.width - logoWidth - 22), rect.x + logoWidth + 20, rect.y + rect.height / 2 + 1);
    context.restore();
  } else {
    context.save();
    context.fillStyle = foreground;
    context.font = '900 30px Montserrat, Inter, Arial, sans-serif';
    context.textBaseline = 'middle';
    context.fillText(fitText(context, content.sellerCompany, rect.width), rect.x, rect.y + rect.height / 2 + 1);
    context.restore();
  }
}

function drawRating(context: CanvasRenderingContext2D, content: MarketplaceAdContent, x: number, y: number) {
  const rating = getMarketplaceAdRating(content);
  context.save();
  context.font = '900 20px Montserrat, Inter, Arial, sans-serif';
  const width = Math.max(152, context.measureText(rating.label).width + 44);
  fillRounded(context, { x, y, width, height: 48 }, 9, rating.background);
  context.fillStyle = rating.foreground;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(rating.label, x + width / 2, y + 25);
  context.restore();
}

function drawAim4priceCredit(context: CanvasRenderingContext2D, x: number, y: number, color: string) {
  context.save();
  context.fillStyle = color;
  context.globalAlpha = .68;
  context.font = '700 13px Montserrat, Inter, Arial, sans-serif';
  context.textAlign = 'right';
  context.fillText('Created with', x - 80, y);
  context.globalAlpha = 1;
  context.font = '900 17px Montserrat, Inter, Arial, sans-serif';
  context.fillText('Aim4price', x, y);
  context.restore();
}

function drawInformationPanel(
  context: CanvasRenderingContext2D,
  content: MarketplaceAdContent,
  logo: HTMLImageElement | null,
  rect: Rect,
  options: { priceFirst?: boolean; light?: boolean } = {},
) {
  const primary = content.brand.primaryColor;
  const secondary = content.brand.secondaryColor;
  const accent = content.brand.accentColor;
  const background = options.light ? '#ffffff' : primary;
  const foreground = options.light ? secondary : contrast(primary);
  context.fillStyle = background;
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  const pad = Math.max(32, rect.width * .07);
  drawBrand(context, content, logo, { x: rect.x + pad, y: rect.y + 22, width: rect.width - pad * 2, height: 82 }, !options.light);
  drawRating(context, content, rect.x + pad, rect.y + 132);

  const titleY = options.priceFirst ? rect.y + 420 : rect.y + 246;
  const priceY = options.priceFirst ? rect.y + 244 : rect.y + 474;
  context.save();
  context.fillStyle = foreground;
  context.font = '950 40px Montserrat, Inter, Arial, sans-serif';
  const titleBottom = wrapText(context, content.title.toUpperCase(), rect.x + pad, titleY, rect.width - pad * 2, 45, 2);
  context.globalAlpha = .78;
  context.font = '700 20px Montserrat, Inter, Arial, sans-serif';
  context.fillText(fitText(context, `${content.year} · ${content.usage} · ${content.condition}`, rect.width - pad * 2), rect.x + pad, titleBottom + 18);
  context.globalAlpha = 1;
  context.restore();

  fillRounded(context, { x: rect.x + pad, y: priceY, width: rect.width - pad * 2, height: 104 }, 15, accent);
  context.save();
  context.fillStyle = contrast(accent);
  context.font = '950 43px Montserrat, Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(fitText(context, money(content.askingPriceExVat), rect.width - pad * 2 - 120), rect.x + rect.width / 2 - 28, priceY + 53);
  context.font = '900 18px Montserrat, Inter, Arial, sans-serif';
  context.fillText(vatLabel(content.brand), rect.x + rect.width - pad - 68, priceY + 55);
  context.restore();

  context.save();
  context.fillStyle = foreground;
  context.globalAlpha = .86;
  context.font = '750 20px Montserrat, Inter, Arial, sans-serif';
  context.fillText(fitText(context, `${content.sellerName} · ${content.sellerPhone}`, rect.width - pad * 2), rect.x + pad, rect.y + rect.height - 94);
  context.restore();
  drawAim4priceCredit(context, rect.x + rect.width - pad, rect.y + rect.height - 34, foreground);
}

function photoRects(templateId: AdTemplateId, photoRect: Rect): Rect[] {
  const gap = 16;
  if (templateId === 'duo-split') {
    return [
      { ...photoRect, height: (photoRect.height - gap) / 2 },
      { ...photoRect, y: photoRect.y + (photoRect.height + gap) / 2, height: (photoRect.height - gap) / 2 },
    ];
  }
  if (templateId === 'gallery-three') {
    const mainWidth = photoRect.width * .64;
    const sideWidth = photoRect.width - mainWidth - gap;
    return [
      { ...photoRect, width: mainWidth },
      { x: photoRect.x + mainWidth + gap, y: photoRect.y, width: sideWidth, height: (photoRect.height - gap) / 2 },
      { x: photoRect.x + mainWidth + gap, y: photoRect.y + (photoRect.height + gap) / 2, width: sideWidth, height: (photoRect.height - gap) / 2 },
    ];
  }
  if (templateId === 'showcase') {
    const mainHeight = photoRect.height * .69;
    const thumbWidth = (photoRect.width - gap * 2) / 3;
    return [
      { ...photoRect, height: mainHeight },
      { x: photoRect.x, y: photoRect.y + mainHeight + gap, width: thumbWidth, height: photoRect.height - mainHeight - gap },
      { x: photoRect.x + thumbWidth + gap, y: photoRect.y + mainHeight + gap, width: thumbWidth, height: photoRect.height - mainHeight - gap },
      { x: photoRect.x + (thumbWidth + gap) * 2, y: photoRect.y + mainHeight + gap, width: thumbWidth, height: photoRect.height - mainHeight - gap },
    ];
  }
  if (templateId === 'catalogue-grid') {
    const cellWidth = (photoRect.width - gap) / 2;
    const cellHeight = (photoRect.height - gap) / 2;
    return [0, 1, 2, 3].map((index) => ({
      x: photoRect.x + (index % 2) * (cellWidth + gap),
      y: photoRect.y + Math.floor(index / 2) * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight,
    }));
  }
  return [photoRect];
}

export async function renderMarketplaceAdCanvas(
  canvas: HTMLCanvasElement,
  content: MarketplaceAdContent,
  options: { useBestPhotoFit?: boolean; includeImages?: boolean } = {},
): Promise<AdTemplateId> {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');
  canvas.width = MARKETPLACE_AD_WIDTH;
  canvas.height = MARKETPLACE_AD_HEIGHT;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  if (typeof document !== 'undefined' && 'fonts' in document) await document.fonts.ready.catch(() => undefined);

  const selectedTemplate = content.brand.templateId;
  const templateId = options.useBestPhotoFit === false
    ? selectedTemplate
    : resolveAdTemplateForPhotoCount(selectedTemplate, content.imageUrls.length);
  const imageCount = getAdTemplatePhotoCount(templateId);
  const sources = options.includeImages === false ? [] : content.imageUrls.slice(0, imageCount);
  const [logo, ...images] = await Promise.all([
    loadImage(content.brand.logoUrl),
    ...sources.map((source) => loadImage(source)),
  ]);

  const width = MARKETPLACE_AD_WIDTH;
  const height = MARKETPLACE_AD_HEIGHT;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#f4f7f5';
  context.fillRect(0, 0, width, height);

  if (templateId === 'photo-first') {
    const full: Rect = { x: 28, y: 28, width: width - 56, height: height - 56 };
    drawPhoto(context, content, images[0] ?? null, 0, full, true);
    context.save();
    roundedPath(context, full, 26);
    context.clip();
    const overlay = context.createLinearGradient(0, 330, 0, height);
    overlay.addColorStop(0, 'rgba(0,0,0,0)');
    overlay.addColorStop(1, 'rgba(0,0,0,.9)');
    context.fillStyle = overlay;
    context.fillRect(full.x, full.y, full.width, full.height);
    context.restore();
    drawBrand(context, content, logo, { x: 72, y: 62, width: 620, height: 84 }, true);
    drawRating(context, content, 1315, 72);
    context.save();
    context.fillStyle = '#fff';
    context.font = '950 57px Montserrat, Inter, Arial, sans-serif';
    const bottom = wrapText(context, content.title.toUpperCase(), 76, 622, 850, 61, 2);
    context.globalAlpha = .8;
    context.font = '750 24px Montserrat, Inter, Arial, sans-serif';
    context.fillText(`${content.year} · ${content.usage} · ${content.condition}`, 78, bottom + 12);
    context.restore();
    fillRounded(context, { x: 1030, y: 644, width: 480, height: 112 }, 17, content.brand.accentColor);
    context.save();
    context.fillStyle = contrast(content.brand.accentColor);
    context.font = '950 42px Montserrat, Inter, Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(fitText(context, money(content.askingPriceExVat), 340), 1235, 700);
    context.font = '900 18px Montserrat, Inter, Arial, sans-serif';
    context.fillText(vatLabel(content.brand), 1438, 702);
    context.restore();
    drawAim4priceCredit(context, 1510, 830, '#ffffff');
    return templateId;
  }

  const minimal = templateId === 'minimal';
  const photoArea: Rect = minimal
    ? { x: 680, y: 28, width: 892, height: 844 }
    : { x: 28, y: 28, width: templateId === 'photo-first' ? 1544 : 950, height: 844 };
  const infoArea: Rect = minimal
    ? { x: 28, y: 28, width: 652, height: 844 }
    : { x: 994, y: 28, width: 578, height: 844 };
  if (templateId === 'classic') {
    context.fillStyle = content.brand.primaryColor;
    context.fillRect(0, 0, width, 18);
    context.fillRect(0, height - 18, width, 18);
    context.fillRect(0, 0, 18, height);
    context.fillRect(width - 18, 0, 18, height);
  }
  const rects = photoRects(templateId, photoArea);
  rects.forEach((rect, index) => drawPhoto(context, content, images[index] ?? null, index, rect, index === 0));
  drawInformationPanel(context, content, logo, infoArea, {
    priceFirst: templateId === 'price-focus',
    light: minimal || templateId === 'classic' || templateId === 'catalogue-grid',
  });
  return templateId;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('JPEG export failed.')), 'image/jpeg', .92);
  });
}

export async function createMarketplaceAdJpeg(listing: MarketplaceListing): Promise<{ blob: Blob; templateId: AdTemplateId }> {
  if (typeof document === 'undefined') throw new Error('JPEG export is only available in the browser.');
  const content = marketplaceListingToAdContent(listing);
  for (const includeImages of [true, false]) {
    const canvas = document.createElement('canvas');
    try {
      const templateId = await renderMarketplaceAdCanvas(canvas, content, { includeImages, useBestPhotoFit: true });
      return { blob: await canvasBlob(canvas), templateId };
    } catch (error) {
      if (!includeImages) throw error;
    }
  }
  throw new Error('JPEG export failed.');
}

export function downloadMarketplaceAd(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 800);
}

export function marketplaceAdFilename(title: string): string {
  const safe = clean(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'aim4price-advert';
  return `${safe}-aim4price-ad.jpg`;
}
