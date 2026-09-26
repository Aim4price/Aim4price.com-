import { WEBSITE_PHONE_SHORT_SIDE_MAX } from './website-canvas';

/** Avoid user-agent sniffing: desktop mode and embedded browsers can disguise it. */
export function shouldShowPhoneLandscapeEntry(input: {
  width: number; height: number; screenWidth: number; screenHeight: number;
  touch: boolean; orientation?: string; legacyAngle?: number;
}): boolean {
  const { width, height, screenWidth, screenHeight, touch, orientation, legacyAngle } = input;
  if (!touch) return false;
  const valid = (value: number) => Number.isFinite(value) && value > 0;
  const hasScreen = valid(screenWidth) && valid(screenHeight);
  // Physical CSS screen size survives desktop mode, keyboards and pinch zoom.
  const shortSide = hasScreen ? Math.min(screenWidth, screenHeight) : Math.min(width, height);
  if (!valid(shortSide) || shortSide > WEBSITE_PHONE_SHORT_SIDE_MAX) return false;
  if (orientation?.startsWith('portrait')) return true;
  if (orientation?.startsWith('landscape')) return false;
  // Older iPhone/WebView implementations expose an angle instead of a type.
  if (typeof legacyAngle === 'number' && Number.isFinite(legacyAngle)) return Math.abs(legacyAngle % 180) === 0;
  return valid(width) && valid(height) && height > width;
}

export function listenToMediaQuery(query: MediaQueryList, listener: () => void): () => void {
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }
  if (typeof query.addListener === 'function') {
    query.addListener(listener);
    return () => query.removeListener(listener);
  }
  return () => {};
}

export function hasTouchInput(query: MediaQueryList): boolean {
  return query.matches || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}

export function phoneNeedsLandscape(query: MediaQueryList): boolean {
  return shouldShowPhoneLandscapeEntry({
    width: document.documentElement.clientWidth || window.innerWidth,
    height: document.documentElement.clientHeight || window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    touch: hasTouchInput(query),
    orientation: window.screen.orientation?.type,
    legacyAngle: (window as Window & { orientation?: number }).orientation,
  });
}

/** Some browsers emit rotation before their viewport geometry has settled. */
export function observePhoneGeometry(query: MediaQueryList, sync: () => void): () => void {
  let frame = 0;
  let timer: ReturnType<typeof setTimeout>;
  const update = () => {
    sync();
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame = requestAnimationFrame(sync);
    timer = setTimeout(sync, 250);
  };
  const orientation = window.screen.orientation;
  const viewport = window.visualViewport;
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  window.addEventListener('pageshow', update);
  document.addEventListener('visibilitychange', update);
  orientation?.addEventListener?.('change', update);
  viewport?.addEventListener('resize', update);
  const stopMedia = listenToMediaQuery(query, update);
  update();
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', update);
    window.removeEventListener('pageshow', update);
    document.removeEventListener('visibilitychange', update);
    orientation?.removeEventListener?.('change', update);
    viewport?.removeEventListener('resize', update);
    stopMedia();
  };
}
