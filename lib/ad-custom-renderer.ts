import { AD_DESIGN_SIZES, normalizeAdCustomDesign, type AdDesignElement } from './ad-custom-design';
import type { MarketplaceAdContent } from './marketplace-ad-renderer';

export function customElementText(e: AdDesignElement, c: MarketplaceAdContent): string {
  const brand = c.brand;
  const vat = brand.vatLabel === 'plus-vat' ? (brand.language === 'af' ? '+ BTW' : '+ VAT') : brand.vatLabel === 'vat-included' ? (brand.language === 'af' ? 'BTW ingesluit' : 'VAT included') : (brand.language === 'af' ? 'Geen BTW' : 'No VAT');
  const fields = { title: c.title, price: `${new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(c.askingPriceExVat)} ${vat}`,
    year: c.year, usage: c.usage, condition: c.condition, business: brand.businessName || c.sellerCompany,
    contact: brand.contactName || c.sellerName, phone: brand.phone || c.sellerPhone, email: brand.email, website: brand.website };
  return e.field ? fields[e.field] || '' : e.text;
}
function textLines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      // Character splitting also handles long emails and unbroken asset names.
      const parts = ctx.measureText(word).width > width ? Array.from(word) : [word];
      for (const [i, part] of parts.entries()) {
        const gap = i === 0 && line ? ' ' : '';
        if (line && ctx.measureText(line + gap + part).width > width) { lines.push(line); line = part; }
        else line += gap + part;
      }
    }
    lines.push(line);
  }
  return lines;
}
export async function renderCustomAd(canvas: HTMLCanvasElement, content: MarketplaceAdContent,
  loadImage: (source: string) => Promise<HTMLImageElement | null>, options: { includeImages?: boolean; requireImages?: boolean }) {
  const design = normalizeAdCustomDesign(content.brand.customDesign);
  if (!design) throw new Error('This custom design could not be opened.');
  const [width, height] = AD_DESIGN_SIZES[design.size];
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = design.background; ctx.fillRect(0, 0, width, height);
  const images = await Promise.all(design.elements.map(async e => {
    const source = e.kind === 'logo' ? content.brand.logoUrl : e.kind === 'photo' ? e.image || content.imageUrls[e.photoIndex] : '';
    const image = source && options.includeImages !== false ? await loadImage(source) : null;
    if (options.requireImages && options.includeImages !== false && ((source && !image) || ((e.kind === 'photo' || e.kind === 'logo') && !source))) throw new Error('A design photo or logo could not be loaded. Add the missing photo or try again.');
    return image;
  }));
  design.elements.forEach((e, i) => {
    ctx.save(); ctx.beginPath(); ctx.rect(e.x, e.y, e.width, e.height); ctx.clip();
    ctx.fillStyle = e.color;
    if (e.kind === 'rectangle') ctx.fillRect(e.x, e.y, e.width, e.height);
    else if (e.kind === 'circle') { ctx.beginPath(); ctx.ellipse(e.x + e.width / 2, e.y + e.height / 2, e.width / 2, e.height / 2, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (e.kind === 'text') {
      const text = customElementText(e, content);
      let size = e.fontSize, lines: string[] = [];
      do {
        ctx.font = `${e.bold ? 700 : 400} ${size}px ${e.font}, Arial, sans-serif`;
        lines = textLines(ctx, text, e.width - 12);
        if (lines.length * size * 1.2 <= e.height - 8 || size <= 12) break;
        size = Math.max(12, size - 1);
      } while (true);
      ctx.textBaseline = 'top'; ctx.textAlign = e.align;
      const x = e.align === 'center' ? e.x + e.width / 2 : e.align === 'right' ? e.x + e.width - 6 : e.x + 6;
      const maxLines = Math.max(1, Math.floor((e.height - 8) / (size * 1.2)));
      lines.slice(0, maxLines).forEach((line, index) => {
        if (index === maxLines - 1 && lines.length > maxLines) {
          while (line && ctx.measureText(`${line}…`).width > e.width - 12) line = line.slice(0, -1);
          line += '…';
        }
        ctx.fillText(line, x, e.y + 4 + index * size * 1.2);
      });
    } else {
      const img = images[i];
      if (img) {
        const scale = e.fit === 'contain' ? Math.min(e.width / img.width, e.height / img.height) : Math.max(e.width / img.width, e.height / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, e.x + (e.width - w) * e.cropX / 100, e.y + (e.height - h) * e.cropY / 100, w, h);
      } else {
        ctx.fillStyle = '#e3eeea'; ctx.fillRect(e.x, e.y, e.width, e.height);
        ctx.fillStyle = '#245b48'; ctx.font = '700 28px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(e.kind === 'logo' ? 'Your logo' : `Photo ${e.photoIndex + 1}`, e.x + e.width / 2, e.y + e.height / 2, e.width - 12);
      }
    }
    ctx.restore();
  });
}
