/** All normal website geometry is expressed in this logical coordinate system. */
export const WEBSITE_DESIGN_WIDTH = 1440;
export const WEBSITE_DESIGN_HEIGHT = 900;
export const WEBSITE_AUTO_MAX_SCALE = 1.2;
export const WEBSITE_MIN_MANUAL_SCALE = 0.15;
export const WEBSITE_MAX_MANUAL_SCALE = 1.5;
export const WEBSITE_SCALE_STEP = 0.01;
export const WEBSITE_PREFERENCE_KEY = 'aim4price.website-canvas.v2';
export const WEBSITE_OVERLAY_ROOT_ID = 'aim4price-website-overlays';
export const WEBSITE_PHONE_SHORT_SIDE_MAX = 560;
export const WEBSITE_LANDSCAPE_BYPASS_KEY = 'aim4price.website-landscape-entry.v1';

const NATIVE_ROUTE_PREFIXES = ['/owner-app', '/dealer', '/middleman', '/field-manager', '/admin', '/scan', '/fuel-scan'];

export function isNativeWorkspace(pathname: string): boolean {
  return NATIVE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function shouldSuggestWebsiteLandscape(width: number, height: number, coarsePointer: boolean): boolean {
  if (!coarsePointer || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
  return height > width && Math.min(width, height) <= WEBSITE_PHONE_SHORT_SIDE_MAX;
}

export function calculateWebsiteScale(availableWidth: number): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1;
  return Math.min(WEBSITE_AUTO_MAX_SCALE, availableWidth / WEBSITE_DESIGN_WIDTH);
}

export function clampManualWebsiteScale(scale: number): number {
  return Math.min(WEBSITE_MAX_MANUAL_SCALE, Math.max(WEBSITE_MIN_MANUAL_SCALE, Number.isFinite(scale) ? scale : 1));
}

/** Step from the displayed percentage, avoiding fractional Auto values and float drift. */
export function stepWebsiteScale(scale: number, delta: number): number {
  return clampManualWebsiteScale((Math.round(scale * 100) + Math.round(delta * 100)) / 100);
}

export type WebsitePreference = { mode: 'auto' } | { mode: 'manual'; scale: number };

export function parseWebsitePreference(saved: string | null): WebsitePreference {
  try {
    const value: unknown = saved ? JSON.parse(saved) : null;
    if (value && typeof value === 'object' && 'mode' in value && value.mode === 'manual'
      && 'scale' in value && typeof value.scale === 'number' && Number.isFinite(value.scale)) {
      return { mode: 'manual', scale: clampManualWebsiteScale(value.scale) };
    }
  } catch { /* A corrupt or unavailable preference falls back to Auto. */ }
  return { mode: 'auto' };
}

/** Native apps retain their existing body portal, without website variables. */
export function websiteOverlayRoot(): HTMLElement {
  return document.getElementById(WEBSITE_OVERLAY_ROOT_ID) ?? document.body;
}

export function currentWebsiteScale(): number {
  const canvas = document.querySelector<HTMLElement>('[data-website-canvas]');
  return canvas ? Number(canvas.dataset.websiteScale) || 1 : 1;
}

/** DOMRect uses rendered CSS pixels; fixed descendants of zoom use logical pixels. */
export function websiteLogicalRect(rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>) {
  const scale = currentWebsiteScale();
  return {
    left: rect.left / scale, top: rect.top / scale,
    right: rect.right / scale, bottom: rect.bottom / scale,
    width: rect.width / scale, height: rect.height / scale,
  };
}

export function websiteVisibleViewport() {
  const scale = currentWebsiteScale();
  const viewport = window.visualViewport;
  return {
    left: (viewport?.offsetLeft ?? 0) / scale,
    top: (viewport?.offsetTop ?? 0) / scale,
    width: (viewport?.width ?? window.innerWidth) / scale,
    height: (viewport?.height ?? window.innerHeight) / scale,
  };
}

