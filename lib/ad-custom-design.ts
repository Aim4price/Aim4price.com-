/** Versioned, bounded design documents shared by the editor, API and renderer. */
export const AD_DESIGN_SIZES = { landscape: [1600, 900], square: [1080, 1080], portrait: [1080, 1350] } as const;
export const AD_DESIGN_FIELDS = {
  title: 'Asset title', price: 'Asking price', year: 'Year', usage: 'Usage', condition: 'Condition',
  business: 'Business name', contact: 'Contact name', phone: 'Phone', email: 'Email', website: 'Website',
} as const;
export type AdDesignField = keyof typeof AD_DESIGN_FIELDS;
export type AdDesignElement = {
  id: string; kind: 'text' | 'photo' | 'logo' | 'rectangle' | 'circle';
  x: number; y: number; width: number; height: number;
  text: string; field?: AdDesignField; photoIndex: number; image: string;
  color: string; fontSize: number; font: 'Arial' | 'Georgia' | 'Montserrat'; bold: boolean;
  align: 'left' | 'center' | 'right'; fit: 'cover' | 'contain'; cropX: number; cropY: number;
};
export type AdCustomDesign = { version: 1; size: keyof typeof AD_DESIGN_SIZES; background: string; elements: AdDesignElement[] };
export const MAX_DESIGN_ELEMENTS = 40;
const color = (v: unknown, fallback: string) => typeof v === 'string' && /^#[a-f0-9]{6}$/i.test(v) ? v : fallback;
const number = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
export function normalizeAdCustomDesign(value: unknown): AdCustomDesign | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const d = value as Record<string, unknown>;
  if (d.version !== 1 || !Array.isArray(d.elements)) return null;
  const size = Object.hasOwn(AD_DESIGN_SIZES, String(d.size)) ? d.size as AdCustomDesign['size'] : 'landscape';
  const [w, h] = AD_DESIGN_SIZES[size];
  let imageBudget = 2_000_000;
  const elements: AdDesignElement[] = [];
  for (const raw of d.elements.slice(0, MAX_DESIGN_ELEMENTS)) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    if (!['text', 'photo', 'logo', 'rectangle', 'circle'].includes(String(e.kind))) continue;
    const width = number(e.width, 300, 24, w), height = number(e.height, 100, 24, h);
    // Only embedded raster images persist. Blob URLs and arbitrary remote URLs cannot leak into saved designs.
    const image = typeof e.image === 'string' && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(e.image) && e.image.length <= imageBudget ? e.image : '';
    imageBudget -= image.length;
    const id = typeof e.id === 'string' ? e.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) : '';
    let uniqueId = id || `element-${elements.length}`;
    while (elements.some(item => item.id === uniqueId)) uniqueId += '-copy';
    elements.push({
      id: uniqueId,
      kind: e.kind as AdDesignElement['kind'], width, height,
      x: number(e.x, 40, 0, w - width), y: number(e.y, 40, 0, h - height),
      text: typeof e.text === 'string' ? e.text.slice(0, 1000) : '',
      field: Object.hasOwn(AD_DESIGN_FIELDS, String(e.field)) ? e.field as AdDesignField : undefined,
      photoIndex: Math.round(number(e.photoIndex, 0, 0, 3)), image,
      color: color(e.color, '#173f31'), fontSize: number(e.fontSize, 48, 12, 240),
      font: e.font === 'Georgia' || e.font === 'Montserrat' ? e.font : 'Arial', bold: e.bold !== false,
      align: e.align === 'center' || e.align === 'right' ? e.align : 'left',
      fit: e.fit === 'contain' ? 'contain' : 'cover', cropX: number(e.cropX, 50, 0, 100), cropY: number(e.cropY, 50, 0, 100),
    });
  }
  return { version: 1, size, background: color(d.background, '#ffffff'), elements };
}
export function createAdDesignElement(kind: AdDesignElement['kind'], field?: AdDesignField): AdDesignElement {
  return { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, kind, field,
    x: 60, y: 60, width: kind === 'text' ? 600 : 360, height: kind === 'text' ? 120 : 300,
    text: field ? '' : 'Your wording', photoIndex: 0, image: '', color: '#173f31', fontSize: 54,
    font: 'Arial', bold: true, align: 'left', fit: kind === 'logo' ? 'contain' : 'cover', cropX: 50, cropY: 50 };
}
export function createAdCustomDesign(): AdCustomDesign {
  return { version: 1, size: 'landscape', background: '#ffffff', elements: [] };
}
export function customDesignPhotoCount(design?: AdCustomDesign | null): number {
  return Math.max(0, ...(design?.elements.filter(e => e.kind === 'photo' && !e.image).map(e => e.photoIndex + 1) ?? []));
}
export function resizeAdDesign(design: AdCustomDesign, size: AdCustomDesign['size']): AdCustomDesign {
  const [w, h] = AD_DESIGN_SIZES[design.size], [nw, nh] = AD_DESIGN_SIZES[size];
  return normalizeAdCustomDesign({ ...design, size, elements: design.elements.map(e => ({ ...e, x: e.x * nw / w, y: e.y * nh / h, width: e.width * nw / w, height: e.height * nh / h, fontSize: e.fontSize * Math.min(nw / w, nh / h) })) })!;
}

export function createStarterAdDesign(primary = '#165340', accent = '#f2b84b'): AdCustomDesign {
  const block = (kind: AdDesignElement['kind'], x: number, y: number, width: number, height: number, field?: AdDesignField, fill = '#ffffff') =>
    ({ ...createAdDesignElement(kind, field), x, y, width, height, color: fill });
  return { ...createAdCustomDesign(), background: '#f2f6f3', elements: [
    block('rectangle', 1020, 0, 580, 900, undefined, primary),
    block('photo', 36, 36, 948, 700),
    { ...block('text', 42, 770, 930, 90, 'title', '#173f31'), fontSize: 58 },
    { ...block('text', 1060, 60, 490, 100, 'business'), fontSize: 45 },
    block('rectangle', 1060, 240, 490, 160, undefined, accent),
    { ...block('text', 1080, 265, 450, 110, 'price', '#173f31'), fontSize: 55 },
    { ...block('text', 1060, 440, 490, 70, 'year'), fontSize: 36 },
    { ...block('text', 1060, 520, 490, 70, 'usage'), fontSize: 36 },
    { ...block('text', 1060, 690, 490, 70, 'contact'), fontSize: 36 },
    { ...block('text', 1060, 770, 490, 70, 'phone'), fontSize: 36 },
  ] };
}
