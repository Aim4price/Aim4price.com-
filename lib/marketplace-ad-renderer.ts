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
const AIM4PRICE_STANDARD_LOGO_SRC = '/brand/Aim4price_Home_Logo.png';
const AIM4PRICE_STANDARD_WATERMARK_SRC = '/brand/aim4price-mark-black.png';

export type MarketplaceAdContent = {
  title: string;
  year: string;
  usage: string;
  condition: string;
  familyLabel: string;
  askingPriceExVat: number;
  aim4priceValueExVat?: number | null;
  dealRating?: MarketplaceDealRating | null;
  showDealRating?: boolean;
  sellerName: string;
  sellerPhone: string;
  sellerCompany: string;
  location?: string;
  imageUrls: string[];
  brand: AdBrandSnapshot;
  design?: MarketplaceAdDesign;
};

export type MarketplaceAdRatingPresentation = {
  value: MarketplaceDealRating;
  label: string;
  background: string;
  foreground: string;
};

export type MarketplaceAdDesign = 'saved-brand' | 'aim4price-marketplace';

export type MarketplaceAdJpegOptions = {
  design?: MarketplaceAdDesign;
};

type Rect = { x: number; y: number; width: number; height: number };

const RATING_PRESENTATION: Record<MarketplaceDealRating, MarketplaceAdRatingPresentation> = {
  low: { value: 'low', label: 'Low price', background: '#f97316', foreground: '#ffffff' },
  great: { value: 'great', label: 'Great price', background: '#22b24b', foreground: '#ffffff' },
  fair: { value: 'fair', label: 'Fair price', background: '#1e9bb3', foreground: '#ffffff' },
  high: { value: 'high', label: 'High price', background: '#ef4444', foreground: '#ffffff' },
  none: { value: 'none', label: 'No rating', background: '#69788a', foreground: '#ffffff' },
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

function naturalTitle(value: string): string {
  const preservedWords = new Set(['AI', 'ATV', 'CAT', 'GPS', 'JCB', 'MF', 'PTO', 'SUV', 'UTV']);
  return clean(value)
    .split(/(\s+|\/|-)/)
    .map((part) => {
      if (!/[A-Za-z]/.test(part) || part !== part.toUpperCase()) return part;
      if (/\d/.test(part) || preservedWords.has(part)) return part;
      return `${part.charAt(0)}${part.slice(1).toLowerCase()}`;
    })
    .join('');
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
  if (brand.vatLabel === 'vat-included') return brand.language === 'af' ? 'BTW ingesluit' : 'VAT included';
  if (brand.vatLabel === 'no-vat') return brand.language === 'af' ? 'Geen BTW' : 'No VAT';
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

function listingYear(listing: MarketplaceListing): string {
  const year = Number(listing.yearModel);
  return Number.isFinite(year) && year > 0 ? String(Math.round(year)) : 'N/A';
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

function equipmentMeta(content: MarketplaceAdContent): string {
  const values = [content.year, content.usage, content.condition]
    .map(clean)
    .filter((value) => value && !/not set$/i.test(value));
  return values.join(' · ') || clean(content.familyLabel);
}

function fallbackMarketplaceBrand(listing: MarketplaceListing): AdBrandSnapshot {
  return {
    name: 'Aim4price standard',
    templateId: 'showcase',
    logoUrl: '',
    primaryColor: DEFAULT_AD_BRAND_COLORS.primary,
    secondaryColor: DEFAULT_AD_BRAND_COLORS.secondary,
    accentColor: DEFAULT_AD_BRAND_COLORS.accent,
    businessName: clean(listing.sellerCompany) || clean(listing.sellerName) || 'Marketplace seller',
    contactName: clean(listing.sellerName),
    phone: clean(listing.sellerPhone),
    email: clean(listing.sellerEmail),
    website: '',
    language: 'en',
    vatLabel: 'plus-vat',
  };
}

function resolveMarketplaceBrand(
  listing: MarketplaceListing,
  design: MarketplaceAdDesign,
): AdBrandSnapshot {
  const savedBrand = listing.adBrand ?? fallbackMarketplaceBrand(listing);
  if (design !== 'aim4price-marketplace') return savedBrand;
  return {
    ...savedBrand,
    name: 'Aim4price standard',
    templateId: 'showcase',
    primaryColor: DEFAULT_AD_BRAND_COLORS.primary,
    secondaryColor: DEFAULT_AD_BRAND_COLORS.secondary,
    accentColor: DEFAULT_AD_BRAND_COLORS.accent,
  };
}

export function marketplaceListingToAdContent(
  listing: MarketplaceListing,
  options: MarketplaceAdJpegOptions = {},
): MarketplaceAdContent {
  const familyLabel = clean(listing.familyLabel) || clean(listing.assetKind) || 'Equipment';
  const design = options.design ?? (listing.adBrand ? 'saved-brand' : 'aim4price-marketplace');
  const brand = resolveMarketplaceBrand(listing, design);
  const calculatedRating = calculateMarketplaceDealRating({
    askingPriceExVat: listing.askingPriceExVat,
    aim4priceValueExVat: listing.aim4priceValueExVat,
    isManualEquipment: isManualListing(listing),
  }).rating;

  return {
    title: listingTitle(listing),
    year: listingYear(listing),
    usage: listingUsage(listing),
    condition: titleCase(clean(listing.conditionLabel || listing.conditionKey) || 'Condition not set'),
    familyLabel: titleCase(familyLabel),
    askingPriceExVat: Number(listing.askingPriceExVat) || 0,
    aim4priceValueExVat: Number(listing.aim4priceValueExVat) || null,
    dealRating: isRating(listing.dealRating) ? listing.dealRating : calculatedRating,
    showDealRating: listing.showDealRating !== false,
    sellerName: clean(brand.contactName || listing.sellerName),
    sellerPhone: clean(brand.phone || listing.sellerPhone),
    sellerCompany: clean(brand.businessName || listing.sellerCompany) || 'Marketplace seller',
    location: [clean(listing.area), clean(listing.province)].filter(Boolean).join(', '),
    imageUrls: listingImages(listing),
    brand,
    design,
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
  const dark = '#10251f';
  const light = '#ffffff';
  return contrastRatio(light, hexColor) >= contrastRatio(dark, hexColor) ? light : dark;
}

function luminance(hexColor: string): number {
  const value = hexColor.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

function contrastRatio(first: string, second: string): number {
  const brighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (brighter + .05) / (darker + .05);
}

function readableColor(preferred: string, background: string, fallback = '#17362c'): string {
  return contrastRatio(preferred, background) >= 4.5 ? preferred : fallback;
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let next = text;
  while (next.length > 3 && context.measureText(`${next}…`).width > maxWidth) next = next.slice(0, -1).trim();
  return `${next}…`;
}

function setFittedFont(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  maximumSize: number,
  minimumSize: number,
): number {
  let size = maximumSize;
  while (size > minimumSize) {
    context.font = `${weight} ${size}px Montserrat, Inter, Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  context.font = `${weight} ${size}px Montserrat, Inter, Arial, sans-serif`;
  return size;
}

type FittedTextOptions = {
  weight: number;
  maximumSize: number;
  minimumSize: number;
  maximumLines: number;
  lineHeightRatio?: number;
  verticalAlign?: 'top' | 'center';
};

type FittedTextResult = {
  bottom: number;
  fontSize: number;
  lines: string[];
};

function layoutTextLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const output: string[] = [];
  let line = '';

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      output.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) output.push(line);
  return output;
}

function fittedTextLayout(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  options: FittedTextOptions,
): { fontSize: number; lineHeight: number; lines: string[] } {
  let fontSize = options.maximumSize;
  let lines: string[] = [];

  while (fontSize >= options.minimumSize) {
    context.font = `${options.weight} ${fontSize}px Montserrat, Inter, Arial, sans-serif`;
    lines = layoutTextLines(context, text, maxWidth);
    const allLinesFit = lines.every((line) => context.measureText(line).width <= maxWidth);
    if (lines.length <= options.maximumLines && allLinesFit) break;
    fontSize -= 1;
  }

  fontSize = Math.max(options.minimumSize, fontSize);
  context.font = `${options.weight} ${fontSize}px Montserrat, Inter, Arial, sans-serif`;
  lines = layoutTextLines(context, text, maxWidth);
  if (lines.length > options.maximumLines) {
    const visible = lines.slice(0, options.maximumLines);
    visible[visible.length - 1] = fitText(
      context,
      lines.slice(options.maximumLines - 1).join(' '),
      maxWidth,
    );
    lines = visible;
  } else {
    lines = lines.map((line) => fitText(context, line, maxWidth));
  }

  return {
    fontSize,
    lineHeight: Math.round(fontSize * (options.lineHeightRatio ?? 1.08)),
    lines,
  };
}

function drawFittedMultilineText(
  context: CanvasRenderingContext2D,
  text: string,
  rect: Rect,
  options: FittedTextOptions,
): FittedTextResult {
  const layout = fittedTextLayout(context, text, rect.width, options);
  const blockHeight = layout.fontSize + Math.max(0, layout.lines.length - 1) * layout.lineHeight;
  const top = options.verticalAlign === 'center'
    ? rect.y + Math.max(0, (rect.height - blockHeight) / 2)
    : rect.y;
  const firstBaseline = top + layout.fontSize * .82;

  layout.lines.forEach((line, index) => {
    context.fillText(line, rect.x, firstBaseline + index * layout.lineHeight);
  });

  return {
    bottom: firstBaseline + Math.max(0, layout.lines.length - 1) * layout.lineHeight + layout.fontSize * .2,
    fontSize: layout.fontSize,
    lines: layout.lines,
  };
}

function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, lines = 2): number {
  const words = text.split(/\s+/).filter(Boolean);
  const output: string[] = [];
  let wordIndex = 0;

  while (wordIndex < words.length && output.length < lines) {
    let line = '';
    while (wordIndex < words.length) {
      const candidate = line ? `${line} ${words[wordIndex]}` : words[wordIndex];
      if (line && context.measureText(candidate).width > maxWidth) break;
      line = candidate;
      wordIndex += 1;
      if (context.measureText(line).width > maxWidth) break;
    }

    if (output.length === lines - 1 && wordIndex < words.length) {
      line = `${line} ${words.slice(wordIndex).join(' ')}`.trim();
      wordIndex = words.length;
    }

    if (line) output.push(fitText(context, line, maxWidth));
  }

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

function isGenericEquipmentPlaceholder(source: string): boolean {
  const normalized = clean(source).split(/[?#]/)[0].toLowerCase();
  return normalized.endsWith('/brand/tractor.png') || normalized === 'brand/tractor.png';
}

function drawCameraIcon(context: CanvasRenderingContext2D, rect: Rect, color: string) {
  const tileSize = Math.max(78, Math.min(132, Math.min(rect.width, rect.height) * .34));
  const tile: Rect = {
    x: rect.x + (rect.width - tileSize) / 2,
    y: rect.y + (rect.height - tileSize) / 2 - tileSize * .08,
    width: tileSize,
    height: tileSize,
  };
  const foreground = contrast(color);
  const width = tileSize * .57;
  const height = tileSize * .38;
  const x = tile.x + (tile.width - width) / 2;
  const y = tile.y + tile.height * .35;
  const lineWidth = Math.max(4, tileSize * .047);

  context.save();
  context.shadowColor = 'rgba(8, 35, 28, .2)';
  context.shadowBlur = 16;
  context.shadowOffsetY = 7;
  fillRounded(context, tile, tileSize * .25, color);
  context.shadowColor = 'transparent';
  context.strokeStyle = foreground;
  context.fillStyle = foreground;
  context.lineWidth = lineWidth;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  roundedPath(context, { x, y, width, height }, tileSize * .07);
  context.stroke();

  context.beginPath();
  context.moveTo(x + width * .2, y);
  context.lineTo(x + width * .32, y - tileSize * .1);
  context.lineTo(x + width * .62, y - tileSize * .1);
  context.lineTo(x + width * .74, y);
  context.stroke();

  context.beginPath();
  context.arc(x + width * .5, y + height * .53, tileSize * .115, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(x + width * .5, y + height * .53, tileSize * .035, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.arc(x + width * .82, y + height * .23, tileSize * .025, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = .75;
  context.lineWidth = Math.max(2, tileSize * .025);
  context.beginPath();
  context.moveTo(tile.x + tile.width * .76, tile.y + tile.height * .19);
  context.lineTo(tile.x + tile.width * .76, tile.y + tile.height * .31);
  context.moveTo(tile.x + tile.width * .7, tile.y + tile.height * .25);
  context.lineTo(tile.x + tile.width * .82, tile.y + tile.height * .25);
  context.stroke();
  context.restore();
}

function drawPhoto(
  context: CanvasRenderingContext2D,
  content: MarketplaceAdContent,
  image: HTMLImageElement | null,
  index: number,
  rect: Rect,
  primary: boolean,
  options: { showPlaceholderLabel?: boolean } = {},
) {
  context.save();
  context.shadowColor = 'rgba(9, 35, 28, 0.11)';
  context.shadowBlur = 14;
  context.shadowOffsetY = 7;
  fillRounded(context, rect, 23, '#edf2ef');
  context.restore();
  if (image) {
    drawCover(context, image, rect, 21);
  } else {
    const gradient = context.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height);
    gradient.addColorStop(0, '#eef4f1');
    gradient.addColorStop(1, '#dce8e2');
    fillRounded(context, rect, 21, gradient);
    drawCameraIcon(context, rect, content.brand.primaryColor);
    if (options.showPlaceholderLabel !== false) {
      context.save();
      context.fillStyle = '#617a71';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '750 17px Montserrat, Inter, Arial, sans-serif';
      context.fillText(primary ? 'Main equipment photo' : `Equipment photo ${index + 1}`, rect.x + rect.width / 2, rect.y + rect.height * .74);
      context.restore();
    }
  }
  strokeRounded(
    context,
    rect,
    21,
    primary ? content.brand.primaryColor : 'rgba(255,255,255,.95)',
    primary ? 3 : 2,
  );
}

function drawBrandHeader(
  context: CanvasRenderingContext2D,
  content: MarketplaceAdContent,
  logo: HTMLImageElement | null,
  rect: Rect,
  options: { foreground: string; logoWidth?: number } ,
) {
  const foreground = options.foreground;
  if (logo) {
    const sourceWidth = logo.naturalWidth || logo.width;
    const sourceHeight = Math.max(1, logo.naturalHeight || logo.height);
    const plateWidth = Math.min(options.logoWidth ?? 196, rect.width * .43);
    const plateHeight = Math.min(92, rect.height - 4);
    const scale = Math.min((plateWidth - 28) / sourceWidth, (plateHeight - 20) / sourceHeight);
    const logoWidth = sourceWidth * scale;
    const logoHeight = sourceHeight * scale;
    const plate: Rect = {
      x: rect.x,
      y: rect.y + (rect.height - plateHeight) / 2,
      width: plateWidth,
      height: plateHeight,
    };
    context.save();
    context.shadowColor = 'rgba(8, 35, 28, .12)';
    context.shadowBlur = 10;
    context.shadowOffsetY = 3;
    fillRounded(context, plate, 14, 'rgba(255, 255, 255, .96)');
    context.restore();
    strokeRounded(context, plate, 14, 'rgba(16, 50, 40, .11)', 1);
    context.drawImage(
      logo,
      plate.x + (plate.width - logoWidth) / 2,
      plate.y + (plate.height - logoHeight) / 2,
      logoWidth,
      logoHeight,
    );
    const nameX = plate.x + plate.width + 20;
    const nameWidth = Math.max(96, rect.x + rect.width - nameX);
    context.save();
    context.fillStyle = foreground;
    context.textBaseline = 'alphabetic';
    drawFittedMultilineText(context, content.sellerCompany, {
      x: nameX,
      y: rect.y,
      width: nameWidth,
      height: rect.height,
    }, {
      weight: 850,
      maximumSize: 28,
      minimumSize: 18,
      maximumLines: 2,
      lineHeightRatio: 1.06,
      verticalAlign: 'center',
    });
    context.restore();
  } else {
    context.save();
    context.fillStyle = foreground;
    context.textBaseline = 'alphabetic';
    drawFittedMultilineText(context, content.sellerCompany, rect, {
      weight: 900,
      maximumSize: 31,
      minimumSize: 20,
      maximumLines: 2,
      lineHeightRatio: 1.06,
      verticalAlign: 'center',
    });
    context.restore();
  }
}

function drawRating(context: CanvasRenderingContext2D, content: MarketplaceAdContent, x: number, y: number): number {
  if (content.showDealRating === false) return 0;
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
  return 48;
}

function drawAim4priceCredit(context: CanvasRenderingContext2D, x: number, y: number, color: string) {
  context.save();
  context.fillStyle = color;
  context.globalAlpha = .74;
  context.font = '800 15px Montserrat, Inter, Arial, sans-serif';
  context.textAlign = 'right';
  context.fillText('Powered by Aim4price.com', x, y);
  context.restore();
}

function displayWebsite(value: string): string {
  return clean(value)
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

function displayPhone(value: string): string {
  const raw = clean(value);
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('27')) {
    return `+27 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return raw;
}

function optionalBrandContacts(content: MarketplaceAdContent): string[] {
  return [clean(content.brand.email), displayWebsite(content.brand.website)].filter(Boolean);
}

function drawPriceCard(context: CanvasRenderingContext2D, content: MarketplaceAdContent, rect: Rect) {
  const accent = content.brand.accentColor;
  const foreground = contrast(accent);
  const price = money(content.askingPriceExVat);
  const vat = vatLabel(content.brand);

  fillRounded(context, rect, Math.min(18, rect.height * .14), accent);
  context.save();
  context.fillStyle = foreground;
  context.textBaseline = 'middle';
  context.globalAlpha = .74;
  context.font = '750 16px Montserrat, Inter, Arial, sans-serif';
  context.textAlign = 'left';
  context.fillText('Asking price', rect.x + 24, rect.y + 25);
  context.globalAlpha = 1;

  context.font = '900 17px Montserrat, Inter, Arial, sans-serif';
  const vatWidth = Math.max(80, context.measureText(vat).width + 24);
  const priceLeft = rect.x + 20;
  const priceWidth = rect.width - vatWidth - 38;
  setFittedFont(context, price, priceWidth, 950, Math.min(62, rect.height * .43), 38);
  context.textAlign = 'center';
  context.fillText(price, priceLeft + priceWidth / 2, rect.y + rect.height * .64);

  context.font = '900 17px Montserrat, Inter, Arial, sans-serif';
  context.textAlign = 'right';
  context.fillText(vat, rect.x + rect.width - 20, rect.y + rect.height * .67);
  context.restore();
}

function drawContactDetails(
  context: CanvasRenderingContext2D,
  content: MarketplaceAdContent,
  rect: Rect,
  color: string,
  options: { surface?: 'light' | 'dark' | 'none' } = {},
) {
  const optional = optionalBrandContacts(content);
  const contactName = clean(content.sellerName);
  const phone = displayPhone(content.sellerPhone);
  if (!contactName && !phone && !optional.length) return;
  const hasSurface = options.surface !== 'none';
  const padding = hasSurface ? 18 : 0;
  const availableWidth = rect.width - padding * 2;
  const left = rect.x + padding;

  context.save();
  if (hasSurface) {
    fillRounded(
      context,
      rect,
      15,
      options.surface === 'dark' ? 'rgba(255,255,255,.09)' : '#f4f8f6',
    );
    strokeRounded(
      context,
      rect,
      15,
      options.surface === 'dark' ? 'rgba(255,255,255,.17)' : '#d6e2dd',
      1,
    );
  } else {
    context.strokeStyle = color;
    context.globalAlpha = .2;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(rect.x, rect.y);
    context.lineTo(rect.x + rect.width, rect.y);
    context.stroke();
  }

  context.fillStyle = color;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.globalAlpha = .95;
  const primaryBaseline = rect.y + padding + 23;
  if (phone) {
    setFittedFont(context, phone, availableWidth * .46, 800, 21, 16);
    const phoneWidth = context.measureText(phone).width;
    if (contactName) {
      const nameWidth = Math.max(80, availableWidth - phoneWidth - 18);
      setFittedFont(context, contactName, nameWidth, 800, 21, 16);
      context.fillText(fitText(context, contactName, nameWidth), left, primaryBaseline);
    }
    context.textAlign = 'right';
    setFittedFont(context, phone, availableWidth * .46, 800, 21, 16);
    context.fillText(phone, rect.x + rect.width - padding, primaryBaseline);
    context.textAlign = 'left';
  } else if (contactName) {
    setFittedFont(context, contactName, availableWidth, 800, 21, 16);
    context.fillText(fitText(context, contactName, availableWidth), left, primaryBaseline);
  }

  optional.slice(0, 2).forEach((line, index) => {
    context.globalAlpha = .8;
    setFittedFont(context, line, availableWidth, 650, 18, 15);
    context.fillText(fitText(context, line, availableWidth), left, primaryBaseline + 31 + index * 31);
  });
  context.restore();
}

function drawAim4priceStandardPhoto(
  context: CanvasRenderingContext2D,
  content: MarketplaceAdContent,
  image: HTMLImageElement | null,
  rect: Rect,
  primary: boolean,
) {
  context.save();
  context.shadowColor = 'rgba(9, 35, 28, .13)';
  context.shadowBlur = primary ? 24 : 14;
  context.shadowOffsetY = primary ? 12 : 7;
  fillRounded(context, rect, primary ? 28 : 17, '#edf3f0');
  context.restore();

  if (image) {
    drawCover(context, image, rect, primary ? 27 : 16);
  } else {
    const gradient = context.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height);
    gradient.addColorStop(0, '#eff5f2');
    gradient.addColorStop(1, '#dfeae5');
    fillRounded(context, rect, primary ? 27 : 16, gradient);
    drawCameraIcon(context, rect, content.brand.primaryColor);
    if (primary) {
      context.save();
      context.fillStyle = '#60766e';
      context.font = '750 18px Montserrat, Inter, Arial, sans-serif';
      context.textAlign = 'center';
      context.fillText('Main equipment photo', rect.x + rect.width / 2, rect.y + rect.height * .75);
      context.restore();
    }
  }

  strokeRounded(context, rect, primary ? 27 : 16, primary ? '#d2ded9' : '#ffffff', primary ? 2 : 3);
}

function drawAim4priceStandardLogo(
  context: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  rect: Rect,
) {
  context.save();
  context.shadowColor = 'rgba(8, 31, 25, .16)';
  context.shadowBlur = 16;
  context.shadowOffsetY = 7;
  fillRounded(context, rect, 15, 'rgba(255,255,255,.97)');
  context.restore();
  strokeRounded(context, rect, 15, 'rgba(16, 50, 40, .12)', 1);

  if (logo) {
    const sourceWidth = logo.naturalWidth || logo.width;
    const sourceHeight = Math.max(1, logo.naturalHeight || logo.height);
    const scale = Math.min((rect.width - 28) / sourceWidth, (rect.height - 20) / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    context.drawImage(logo, rect.x + (rect.width - width) / 2, rect.y + (rect.height - height) / 2, width, height);
    return;
  }

  context.save();
  context.fillStyle = '#102f26';
  context.font = '900 23px Montserrat, Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('Aim4price', rect.x + rect.width / 2, rect.y + rect.height / 2 + 1);
  context.restore();
}

function drawAim4priceStandardWatermark(
  context: CanvasRenderingContext2D,
  watermark: HTMLImageElement | null,
  rect: Rect,
) {
  if (!watermark) return;
  const sourceWidth = watermark.naturalWidth || watermark.width;
  const sourceHeight = Math.max(1, watermark.naturalHeight || watermark.height);
  const scale = Math.min(rect.width / sourceWidth, rect.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  context.save();
  context.globalAlpha = .035;
  context.drawImage(
    watermark,
    rect.x + (rect.width - width) / 2,
    rect.y + (rect.height - height) / 2,
    width,
    height,
  );
  context.restore();
}

function drawAim4priceStandardDetail(
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  rect: Rect,
) {
  fillRounded(context, rect, 13, '#ffffff');
  strokeRounded(context, rect, 13, '#d6e2dd', 2);
  context.save();
  context.fillStyle = '#6b7e77';
  context.font = '750 16px Montserrat, Inter, Arial, sans-serif';
  context.fillText(label, rect.x + 18, rect.y + 26);
  context.fillStyle = '#17362c';
  setFittedFont(context, value, rect.width - 36, 850, 24, 17);
  context.fillText(fitText(context, value, rect.width - 36), rect.x + 18, rect.y + 60);
  context.restore();
}

function drawAim4priceStandardContact(
  context: CanvasRenderingContext2D,
  content: MarketplaceAdContent,
  rect: Rect,
) {
  fillRounded(context, rect, 16, '#f7faf8');
  strokeRounded(context, rect, 16, '#165f49', 2);
  const optional = optionalBrandContacts(content);
  context.save();
  context.fillStyle = '#17362c';
  context.font = '850 22px Montserrat, Inter, Arial, sans-serif';
  context.fillText(fitText(context, content.sellerCompany, rect.width - 36), rect.x + 18, rect.y + 34);
  context.fillStyle = '#526b62';
  context.font = '700 17px Montserrat, Inter, Arial, sans-serif';
  const primary = [clean(content.sellerName), displayPhone(content.sellerPhone)].filter(Boolean).join(' · ');
  context.fillText(fitText(context, primary, rect.width - 36), rect.x + 18, rect.y + 70);
  optional.slice(0, 2).forEach((line, index) => {
    context.fillText(fitText(context, line, rect.width - 36), rect.x + 18, rect.y + 104 + index * 28);
  });
  context.restore();
}

async function renderAim4priceStandardCanvas(
  context: CanvasRenderingContext2D,
  content: MarketplaceAdContent,
  includeImages: boolean,
): Promise<void> {
  const sources = includeImages ? content.imageUrls.slice(0, 4) : [];
  const [aim4priceLogo, aim4priceWatermark, ...images] = await Promise.all([
    loadImage(AIM4PRICE_STANDARD_LOGO_SRC),
    loadImage(AIM4PRICE_STANDARD_WATERMARK_SRC),
    ...sources.map((source) => isGenericEquipmentPlaceholder(source) ? Promise.resolve(null) : loadImage(source)),
  ]);
  const width = MARKETPLACE_AD_WIDTH;
  const height = MARKETPLACE_AD_HEIGHT;
  const frame: Rect = { x: 36, y: 36, width: width - 72, height: height - 72 };
  const photoArea: Rect = { x: 64, y: 72, width: 904, height: 764 };
  const contentX = 1010;
  const contentWidth = 526;
  const thumbGap = 14;
  const thumbHeight = 158;
  const photoRowGap = 16;
  const mainHeight = photoArea.height - thumbHeight - photoRowGap;
  const thumbWidth = (photoArea.width - thumbGap * 2) / 3;

  context.clearRect(0, 0, width, height);
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#edf3f0');
  background.addColorStop(1, '#dfe9e4');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.save();
  context.shadowColor = 'rgba(12, 28, 24, .11)';
  context.shadowBlur = 30;
  context.shadowOffsetY = 18;
  fillRounded(context, frame, 40, '#ffffff');
  context.restore();
  strokeRounded(context, frame, 40, '#d7e1dd', 2);
  drawAim4priceStandardWatermark(context, aim4priceWatermark, {
    x: contentX - 8,
    y: 226,
    width: contentWidth + 10,
    height: 350,
  });

  const mainPhoto: Rect = { ...photoArea, height: mainHeight };
  drawAim4priceStandardPhoto(context, content, images[0] ?? null, mainPhoto, true);
  for (let index = 0; index < 3; index += 1) {
    drawAim4priceStandardPhoto(context, content, images[index + 1] ?? null, {
      x: photoArea.x + index * (thumbWidth + thumbGap),
      y: photoArea.y + mainHeight + photoRowGap,
      width: thumbWidth,
      height: thumbHeight,
    }, false);
  }
  drawAim4priceStandardLogo(context, aim4priceLogo, {
    x: photoArea.x + 22,
    y: photoArea.y + 22,
    width: 250,
    height: 70,
  });

  context.save();
  context.strokeStyle = '#e0e8e4';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(989, 78);
  context.lineTo(989, 824);
  context.stroke();
  context.restore();

  drawRating(context, content, contentX, 72);
  if (content.location) {
    context.save();
    context.fillStyle = '#61756e';
    context.font = '750 17px Montserrat, Inter, Arial, sans-serif';
    context.textAlign = 'right';
    context.fillText(fitText(context, content.location, 280), contentX + contentWidth, 104);
    context.restore();
  }

  const price = money(content.askingPriceExVat);
  const vat = vatLabel(content.brand);
  context.save();
  context.fillStyle = '#102f26';
  setFittedFont(context, price, contentWidth - 128, 950, 68, 48);
  context.fillText(price, contentX, 196);
  const priceWidth = context.measureText(price).width;
  context.font = '850 21px Montserrat, Inter, Arial, sans-serif';
  context.fillText(vat, contentX + Math.min(contentWidth - 110, priceWidth + 20), 190);
  context.fillStyle = '#17362c';
  context.font = '850 40px Montserrat, Inter, Arial, sans-serif';
  const titleBottom = wrapText(context, naturalTitle(content.title), contentX, 252, contentWidth, 44, 2);
  context.fillStyle = '#63776f';
  context.font = '700 18px Montserrat, Inter, Arial, sans-serif';
  const metaY = titleBottom - 15;
  context.fillText(fitText(context, equipmentMeta(content), contentWidth), contentX, metaY);
  context.restore();

  const detailGap = 12;
  const detailWidth = (contentWidth - detailGap) / 2;
  const detailHeight = 72;
  const detailTop = Math.max(376, metaY + 28);
  const secondDetailTop = detailTop + detailHeight + detailGap;
  const contactTop = secondDetailTop + detailHeight + 18;
  drawAim4priceStandardDetail(context, 'Year', content.year || 'N/A', { x: contentX, y: detailTop, width: detailWidth, height: detailHeight });
  drawAim4priceStandardDetail(context, 'Usage', content.usage || 'Not set', { x: contentX + detailWidth + detailGap, y: detailTop, width: detailWidth, height: detailHeight });
  drawAim4priceStandardDetail(context, 'Condition', content.condition || 'Not set', { x: contentX, y: secondDetailTop, width: detailWidth, height: detailHeight });
  drawAim4priceStandardDetail(context, 'Equipment', content.familyLabel || 'Equipment', { x: contentX + detailWidth + detailGap, y: secondDetailTop, width: detailWidth, height: detailHeight });
  drawAim4priceStandardContact(context, content, { x: contentX, y: contactTop, width: contentWidth, height: 168 });
  drawAim4priceCredit(context, contentX + contentWidth, 816, '#17362c');
}

function drawInformationPanel(
  context: CanvasRenderingContext2D,
  content: MarketplaceAdContent,
  logo: HTMLImageElement | null,
  rect: Rect,
  options: { variant?: 'standard' | 'price-focus' | 'classic' | 'minimal' | 'catalogue' } = {},
) {
  const primary = content.brand.primaryColor;
  const secondary = content.brand.secondaryColor;
  const variant = options.variant ?? 'standard';
  const light = variant === 'classic' || variant === 'minimal' || variant === 'catalogue';
  const background = light ? '#ffffff' : primary;
  const foreground = light ? readableColor(secondary, background) : contrast(primary);
  const pad = Math.max(36, rect.width * .07);
  const contentWidth = rect.width - pad * 2;
  const contactHeight = 126;
  const contactTop = rect.y + rect.height - 205;

  context.save();
  context.shadowColor = 'rgba(9, 35, 28, .08)';
  context.shadowBlur = 12;
  context.shadowOffsetY = 5;
  fillRounded(context, rect, 24, background);
  context.restore();
  strokeRounded(
    context,
    rect,
    24,
    light ? '#dbe6e1' : 'rgba(255,255,255,.11)',
    1,
  );

  drawBrandHeader(context, content, logo, {
    x: rect.x + pad,
    y: rect.y + 14,
    width: contentWidth,
    height: 108,
  }, { foreground, logoWidth: variant === 'minimal' ? 208 : 190 });

  let cursor = rect.y + 136;
  const ratingHeight = drawRating(context, content, rect.x + pad, cursor);
  cursor += ratingHeight ? ratingHeight + 22 : 36;

  if (variant === 'price-focus') {
    drawPriceCard(context, content, {
      x: rect.x + pad,
      y: cursor,
      width: contentWidth,
      height: 154,
    });
    cursor += 178;
  }

  context.save();
  context.fillStyle = foreground;
  context.textBaseline = 'alphabetic';
  const title = drawFittedMultilineText(context, naturalTitle(content.title), {
    x: rect.x + pad,
    y: cursor,
    width: contentWidth,
    height: Math.max(110, contactTop - cursor - (variant === 'price-focus' ? 66 : 218)),
  }, {
    weight: 860,
    maximumSize: variant === 'minimal' ? 43 : 41,
    minimumSize: variant === 'minimal' ? 29 : 27,
    maximumLines: 3,
    lineHeightRatio: 1.04,
  });
  cursor = title.bottom + 16;
  context.globalAlpha = .78;
  const meta = equipmentMeta(content);
  setFittedFont(context, meta, contentWidth, 700, 20, 16);
  context.fillText(fitText(context, meta, contentWidth), rect.x + pad, cursor + 18);
  context.globalAlpha = 1;
  context.restore();
  cursor += 44;

  if (variant !== 'price-focus') {
    const priceHeight = variant === 'minimal' ? 138 : 144;
    const maximumPriceTop = contactTop - priceHeight - 22;
    drawPriceCard(context, content, {
      x: rect.x + pad,
      y: Math.min(cursor, maximumPriceTop),
      width: contentWidth,
      height: priceHeight,
    });
  }

  drawContactDetails(context, content, {
    x: rect.x + pad,
    y: contactTop,
    width: contentWidth,
    height: contactHeight,
  }, foreground, { surface: light ? 'light' : 'dark' });
  drawAim4priceCredit(context, rect.x + rect.width - pad, rect.y + rect.height - 25, foreground);
}

function photoRects(templateId: AdTemplateId, photoRect: Rect): Rect[] {
  const gap = 14;
  if (templateId === 'duo-split') {
    return [
      { ...photoRect, height: (photoRect.height - gap) / 2 },
      { ...photoRect, y: photoRect.y + (photoRect.height + gap) / 2, height: (photoRect.height - gap) / 2 },
    ];
  }
  if (templateId === 'gallery-three') {
    const mainWidth = photoRect.width * .65;
    const sideWidth = photoRect.width - mainWidth - gap;
    return [
      { ...photoRect, width: mainWidth },
      { x: photoRect.x + mainWidth + gap, y: photoRect.y, width: sideWidth, height: (photoRect.height - gap) / 2 },
      { x: photoRect.x + mainWidth + gap, y: photoRect.y + (photoRect.height + gap) / 2, width: sideWidth, height: (photoRect.height - gap) / 2 },
    ];
  }
  if (templateId === 'showcase') {
    const mainHeight = photoRect.height * .7;
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

  if (content.design === 'aim4price-marketplace') {
    await renderAim4priceStandardCanvas(context, content, options.includeImages !== false);
    return 'showcase';
  }

  const selectedTemplate = content.brand.templateId;
  const templateId = options.useBestPhotoFit === false
    ? selectedTemplate
    : resolveAdTemplateForPhotoCount(selectedTemplate, content.imageUrls.length);
  const imageCount = getAdTemplatePhotoCount(templateId);
  const sources = options.includeImages === false ? [] : content.imageUrls.slice(0, imageCount);
  const [logo, ...images] = await Promise.all([
    loadImage(content.brand.logoUrl),
    ...sources.map((source) => isGenericEquipmentPlaceholder(source) ? Promise.resolve(null) : loadImage(source)),
  ]);

  const width = MARKETPLACE_AD_WIDTH;
  const height = MARKETPLACE_AD_HEIGHT;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#f4f7f5';
  context.fillRect(0, 0, width, height);

  if (templateId === 'photo-first') {
    const full: Rect = { x: 28, y: 28, width: width - 56, height: height - 56 };
    drawPhoto(context, content, images[0] ?? null, 0, full, true, { showPlaceholderLabel: false });
    context.save();
    roundedPath(context, full, 26);
    context.clip();
    const overlay = context.createLinearGradient(0, 280, 0, height);
    overlay.addColorStop(0, 'rgba(0,0,0,0)');
    overlay.addColorStop(.58, 'rgba(0,0,0,.16)');
    overlay.addColorStop(1, 'rgba(0,0,0,.94)');
    context.fillStyle = overlay;
    context.fillRect(full.x, full.y, full.width, full.height);
    context.restore();
    fillRounded(context, { x: 58, y: 50, width: 842, height: 124 }, 18, 'rgba(9, 40, 32, .78)');
    strokeRounded(context, { x: 58, y: 50, width: 842, height: 124 }, 18, 'rgba(255,255,255,.16)', 1);
    drawBrandHeader(context, content, logo, { x: 76, y: 58, width: 806, height: 108 }, {
      foreground: '#ffffff',
      logoWidth: 224,
    });
    drawRating(context, content, 1320, 68);
    context.save();
    context.fillStyle = '#fff';
    context.shadowColor = 'rgba(0,0,0,.42)';
    context.shadowBlur = 12;
    context.shadowOffsetY = 4;
    const title = drawFittedMultilineText(context, naturalTitle(content.title), {
      x: 76,
      y: 492,
      width: 862,
      height: 132,
    }, {
      weight: 860,
      maximumSize: 54,
      minimumSize: 36,
      maximumLines: 2,
      lineHeightRatio: 1.04,
    });
    context.shadowColor = 'transparent';
    context.globalAlpha = .8;
    const meta = equipmentMeta(content);
    setFittedFont(context, meta, 862, 750, 23, 18);
    context.fillText(fitText(context, meta, 862), 78, title.bottom + 30);
    context.restore();
    drawPriceCard(context, content, { x: 1012, y: 588, width: 500, height: 168 });
    drawContactDetails(context, content, { x: 76, y: 716, width: 862, height: 118 }, '#ffffff', { surface: 'dark' });
    drawAim4priceCredit(context, 1510, 838, '#ffffff');
    return templateId;
  }

  const minimal = templateId === 'minimal';
  const photoArea: Rect = minimal
    ? { x: 680, y: 28, width: 892, height: 844 }
    : { x: 28, y: 28, width: 950, height: 844 };
  const infoArea: Rect = minimal
    ? { x: 28, y: 28, width: 652, height: 844 }
    : { x: 994, y: 28, width: 578, height: 844 };
  if (templateId === 'classic') {
    strokeRounded(context, { x: 8, y: 8, width: width - 16, height: height - 16 }, 27, content.brand.primaryColor, 9);
  }
  const rects = photoRects(templateId, photoArea);
  const equalPhotoWeight = templateId === 'duo-split' || templateId === 'catalogue-grid';
  rects.forEach((rect, index) => drawPhoto(
    context,
    content,
    images[index] ?? null,
    index,
    rect,
    !equalPhotoWeight && index === 0,
  ));
  drawInformationPanel(context, content, logo, infoArea, {
    variant: templateId === 'price-focus'
      ? 'price-focus'
      : templateId === 'classic'
        ? 'classic'
        : templateId === 'minimal'
          ? 'minimal'
          : templateId === 'catalogue-grid'
            ? 'catalogue'
            : 'standard',
  });
  return templateId;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('JPEG export failed.')), 'image/jpeg', .92);
  });
}

export async function createMarketplaceAdJpeg(
  listing: MarketplaceListing,
  options: MarketplaceAdJpegOptions = {},
): Promise<{ blob: Blob; templateId: AdTemplateId }> {
  if (typeof document === 'undefined') throw new Error('JPEG export is only available in the browser.');
  const content = marketplaceListingToAdContent(listing, options);
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
