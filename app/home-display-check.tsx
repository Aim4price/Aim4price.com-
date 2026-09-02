'use client';

import Image from 'next/image';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import pageStyles from './page.module.css';
import styles from './home-display-check.module.css';

const DISPLAY_COMPLETED_KEY = 'aim4price:home-display-check:completed:v3';
const DISPLAY_PREFERENCE_KEY = 'aim4price:home-display-preference:v4';
const DISPLAY_STORAGE_BACKEND_KEY = 'aim4price:home-display-storage-backend';
const STALE_DISPLAY_KEYS = [
  'aim4price:home-display-check:completed:v2',
  'aim4price:home-display-check:completed',
  'aim4price:home-display-preference:v3',
  'aim4price:home-display-preference:v2',
  'aim4price:home-display-preference:v1',
  'aim4price:home-display-check:v2',
  'aim4price:home-display-check:v1',
] as const;
const DISPLAY_PREFERENCE_VERSION = 4;
const STANDARD_CANVAS_WIDTH = 1360;
const STANDARD_HERO_HEIGHT = 620;
const MIN_SITE_SCALE = 0.1;
const MAX_SITE_SCALE = 1.5;
const SITE_SCALE_STEP = 0.05;
const VIEWPORT_HORIZONTAL_INSET = 32;
const VIEWPORT_VERTICAL_INSET = 48;
const PREVIEW_SAFE_WIDTH = 0.92;
const PREVIEW_SAFE_HEIGHT = 0.84;

type ViewportSize = {
  width: number;
  height: number;
};

type DisplaySignature = ViewportSize & {
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
};

type StoredDisplayPreference = {
  version: typeof DISPLAY_PREFERENCE_VERSION;
  scale: number;
  viewport: DisplaySignature;
};

const HomeDisplayReadyContext = createContext(true);
const HomeDisplayScaleContext = createContext(1);

export function useHomeDisplayReady() {
  return useContext(HomeDisplayReadyContext);
}

export function useHomeDisplayScale() {
  return useContext(HomeDisplayScaleContext);
}

const clampSiteScale = (scale: number) =>
  Math.min(MAX_SITE_SCALE, Math.max(MIN_SITE_SCALE, scale));

const normalizeSiteScale = (scale: number) =>
  Number(clampSiteScale(scale).toFixed(2));

const getViewportSize = (): ViewportSize => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const getDisplaySignature = (): DisplaySignature => ({
  ...getViewportSize(),
  screenWidth: window.screen?.width ?? window.innerWidth,
  screenHeight: window.screen?.height ?? window.innerHeight,
  pixelRatio: window.devicePixelRatio || 1,
});

const getRawFitLimit = (viewport: ViewportSize) =>
  Math.min(
    1,
    Math.max(0, viewport.width - VIEWPORT_HORIZONTAL_INSET) /
      STANDARD_CANVAS_WIDTH,
    Math.max(0, viewport.height - VIEWPORT_VERTICAL_INSET) /
      STANDARD_HERO_HEIGHT,
  );

const getRecommendedScale = (viewport: ViewportSize) => {
  const fitLimit = getRawFitLimit(viewport);
  const steppedScale =
    Math.floor((fitLimit + Number.EPSILON) / SITE_SCALE_STEP) * SITE_SCALE_STEP;

  return normalizeSiteScale(steppedScale);
};

const doesScaleFitViewport = (viewport: ViewportSize, scale: number) =>
  STANDARD_CANVAS_WIDTH * scale <=
    Math.max(1, viewport.width - VIEWPORT_HORIZONTAL_INSET) &&
  STANDARD_HERO_HEIGHT * scale <=
    Math.max(1, viewport.height - VIEWPORT_VERTICAL_INSET);

const relativeDifference = (left: number, right: number) =>
  Math.abs(left - right) / Math.max(1, left, right);

const hasDisplayMateriallyChanged = (
  previous: DisplaySignature,
  current: DisplaySignature,
) => {
  const orientationChanged =
    previous.width >= previous.height !== current.width >= current.height;

  return (
    orientationChanged ||
    relativeDifference(previous.width, current.width) > 0.08 ||
    relativeDifference(previous.height, current.height) > 0.2 ||
    relativeDifference(previous.screenWidth, current.screenWidth) > 0.08 ||
    relativeDifference(previous.screenHeight, current.screenHeight) > 0.08 ||
    relativeDifference(previous.pixelRatio, current.pixelRatio) > 0.08
  );
};

const hasSecureConnection = () => {
  if (window.location.protocol === 'https:' && window.isSecureContext) return true;

  return (
    window.isSecureContext &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
  );
};

const getSecureHref = () => {
  try {
    const url = new URL(window.location.href);
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return 'https://www.aim4price.com/';
  }
};

const readStorageItem = (key: string) => {
  let preferSession = false;
  try {
    preferSession =
      window.sessionStorage.getItem(DISPLAY_STORAGE_BACKEND_KEY) === 'session';
  } catch {
    // Persistent storage remains the default when session storage is unavailable.
  }

  const storageCandidates = preferSession
    ? [() => window.sessionStorage, () => window.localStorage]
    : [() => window.localStorage, () => window.sessionStorage];

  for (const getStorage of storageCandidates) {
    try {
      const value = getStorage().getItem(key);
      if (value !== null) return value;
    } catch {
      // Try the session-only fallback when persistent storage is restricted.
    }
  }

  return null;
};

const writeStorageItem = (key: string, value: string) => {
  let preferSession = false;
  try {
    preferSession =
      window.sessionStorage.getItem(DISPLAY_STORAGE_BACKEND_KEY) === 'session';
  } catch {
    // Try persistent storage first below.
  }

  if (preferSession) {
    try {
      window.sessionStorage.setItem(key, value);
      return;
    } catch {
      // The session backend became unavailable; retry persistent storage.
    }
  }

  try {
    window.localStorage.setItem(key, value);
    try {
      window.sessionStorage.removeItem(DISPLAY_STORAGE_BACKEND_KEY);
    } catch {
      // The successful persistent write is still authoritative.
    }
    return;
  } catch {
    try {
      window.sessionStorage.setItem(key, value);
      window.sessionStorage.setItem(DISPLAY_STORAGE_BACKEND_KEY, 'session');
    } catch {
      // Component state still keeps the acknowledgement for this page view.
    }
  }
};

const removeStorageItem = (key: string) => {
  for (const getStorage of [
    () => window.localStorage,
    () => window.sessionStorage,
  ]) {
    try {
      getStorage().removeItem(key);
    } catch {
      // The in-memory mandatory gate remains authoritative if storage is restricted.
    }
  }
};

const isValidSignature = (value: unknown): value is DisplaySignature => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const signature = value as Partial<DisplaySignature>;

  return [
    signature.width,
    signature.height,
    signature.screenWidth,
    signature.screenHeight,
    signature.pixelRatio,
  ].every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry > 0);
};

const readStoredPreference = (): StoredDisplayPreference | null => {
  try {
    const raw = readStorageItem(DISPLAY_PREFERENCE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredDisplayPreference>;
    if (
      parsed.version !== DISPLAY_PREFERENCE_VERSION ||
      typeof parsed.scale !== 'number' ||
      !Number.isFinite(parsed.scale) ||
      parsed.scale < MIN_SITE_SCALE ||
      parsed.scale > MAX_SITE_SCALE ||
      !isValidSignature(parsed.viewport)
    ) {
      removeStorageItem(DISPLAY_PREFERENCE_KEY);
      return null;
    }

    return {
      version: DISPLAY_PREFERENCE_VERSION,
      scale: normalizeSiteScale(parsed.scale),
      viewport: parsed.viewport,
    };
  } catch {
    removeStorageItem(DISPLAY_PREFERENCE_KEY);
    return null;
  }
};

const persistDisplayCompletion = (preference: StoredDisplayPreference) => {
  writeStorageItem(DISPLAY_COMPLETED_KEY, '1');
  writeStorageItem(DISPLAY_PREFERENCE_KEY, JSON.stringify(preference));
};

const readDisplayCompletion = () => {
  const isCompleted = readStorageItem(DISPLAY_COMPLETED_KEY) === '1';
  const preference = readStoredPreference();

  for (const key of STALE_DISPLAY_KEYS) {
    removeStorageItem(key);
  }

  if (isCompleted && preference) {
    return { completed: true, preference } as const;
  }

  removeStorageItem(DISPLAY_COMPLETED_KEY);
  if (preference) removeStorageItem(DISPLAY_PREFERENCE_KEY);
  return { completed: false, preference: null } as const;
};

export default function HomeDisplayCheck({ children }: { children: ReactNode }) {
  const [siteScale, setSiteScale] = useState(1);
  const [viewport, setViewport] = useState<ViewportSize>({
    width: STANDARD_CANVAS_WIDTH + VIEWPORT_HORIZONTAL_INSET,
    height: 900,
  });
  const [isMounted, setIsMounted] = useState(false);
  const [isGateOpen, setIsGateOpen] = useState(true);
  const [isDisplayReady, setIsDisplayReady] = useState(false);
  const [isSecure, setIsSecure] = useState(false);
  const [doesPreviewFit, setDoesPreviewFit] = useState(false);
  const [secureHref, setSecureHref] = useState('https://www.aim4price.com/');

  const contentRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const viewportTimerRef = useRef<number | null>(null);
  const hasCompletedCheckRef = useRef(false);
  const displayPreferenceRef = useRef<StoredDisplayPreference | null>(null);

  const recommendedScale = useMemo(
    () => getRecommendedScale(viewport),
    [viewport],
  );

  const previewStyle = useMemo(() => {
    const fitLimit = Math.max(MIN_SITE_SCALE, getRawFitLimit(viewport));
    const sizeRatio = siteScale / fitLimit;

    return {
      '--display-preview-width': `${PREVIEW_SAFE_WIDTH * sizeRatio * 100}%`,
      '--display-preview-height': `${PREVIEW_SAFE_HEIGHT * sizeRatio * 100}%`,
    } as CSSProperties;
  }, [siteScale, viewport]);

  const canvasStyle = useMemo(() => {
    const logicalViewportHeight = Math.max(
      STANDARD_HERO_HEIGHT,
      viewport.height / Math.max(MIN_SITE_SCALE, siteScale),
    );

    return {
      '--aim4price-site-scale': String(siteScale),
      '--aim4price-scaled-canvas-width': `${STANDARD_CANVAS_WIDTH * siteScale}px`,
      '--aim4price-canvas-height': `${logicalViewportHeight}px`,
      '--aim4price-story-height': `${logicalViewportHeight * 4.4}px`,
    } as CSSProperties;
  }, [siteScale, viewport.height]);

  const measurePreviewFit = useCallback(() => {
    const frame = frameRef.current?.getBoundingClientRect();
    const preview = previewRef.current?.getBoundingClientRect();
    if (!frame || !preview) {
      setDoesPreviewFit(false);
      return;
    }

    const safeInset = 5;
    setDoesPreviewFit(
      doesScaleFitViewport(viewport, siteScale) &&
        preview.left >= frame.left + safeInset &&
        preview.top >= frame.top + safeInset &&
        preview.right <= frame.right - safeInset &&
        preview.bottom <= frame.bottom - safeInset,
    );
  }, [siteScale, viewport]);

  const scheduleFitMeasurement = useCallback(() => {
    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current);
    }

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null;
      measurePreviewFit();
    });
  }, [measurePreviewFit]);

  const openRequiredCheck = useCallback((nextViewport: ViewportSize) => {
    setViewport(nextViewport);
    setSiteScale(getRecommendedScale(nextViewport));
    setDoesPreviewFit(false);
    setIsDisplayReady(false);
    setIsGateOpen(true);
  }, []);

  const completeDisplayCheck = useCallback((selectedScale: number) => {
    const nextSignature = getDisplaySignature();
    const nextIsSecure = hasSecureConnection();

    if (!nextIsSecure || !doesScaleFitViewport(nextSignature, selectedScale)) {
      setIsSecure(nextIsSecure);
      openRequiredCheck(nextSignature);
      return;
    }

    const preference: StoredDisplayPreference = {
      version: DISPLAY_PREFERENCE_VERSION,
      scale: normalizeSiteScale(selectedScale),
      viewport: nextSignature,
    };

    setViewport(nextSignature);
    setSiteScale(preference.scale);
    persistDisplayCompletion(preference);
    hasCompletedCheckRef.current = true;
    displayPreferenceRef.current = preference;
    setIsGateOpen(false);
    setIsDisplayReady(true);

    window.requestAnimationFrame(() => {
      document.getElementById('home-hero-title')?.focus();
    });
  }, [openRequiredCheck]);

  useEffect(() => {
    setIsMounted(true);

    const syncCapability = () => {
      const nextSignature = getDisplaySignature();
      const nextIsSecure = hasSecureConnection();
      const completion = readDisplayCompletion();
      const savedPreference = completion.preference;

      setViewport(nextSignature);
      setIsSecure(nextIsSecure);
      setSecureHref(getSecureHref());
      hasCompletedCheckRef.current = completion.completed;
      displayPreferenceRef.current = savedPreference;

      if (
        nextIsSecure &&
        completion.completed &&
        savedPreference &&
        doesScaleFitViewport(nextSignature, savedPreference.scale) &&
        !hasDisplayMateriallyChanged(savedPreference.viewport, nextSignature)
      ) {
        setSiteScale(savedPreference.scale);
        setIsGateOpen(false);
        setIsDisplayReady(true);
        return;
      }

      openRequiredCheck(nextSignature);
    };

    syncCapability();
    window.addEventListener('storage', syncCapability);
    return () => window.removeEventListener('storage', syncCapability);
  }, [openRequiredCheck]);

  useEffect(() => {
    const syncViewport = () => {
      const nextSignature = getDisplaySignature();
      setViewport(nextSignature);

      if (!isDisplayReady || !hasCompletedCheckRef.current) return;

      const preference = displayPreferenceRef.current;
      if (
        !preference ||
        !doesScaleFitViewport(nextSignature, preference.scale) ||
        hasDisplayMateriallyChanged(preference.viewport, nextSignature)
      ) {
        openRequiredCheck(nextSignature);
      }
    };

    const scheduleViewportSync = () => {
      if (viewportTimerRef.current !== null) {
        window.clearTimeout(viewportTimerRef.current);
      }

      viewportTimerRef.current = window.setTimeout(() => {
        viewportTimerRef.current = null;
        syncViewport();
      }, 180);
    };

    window.addEventListener('resize', scheduleViewportSync, { passive: true });
    window.addEventListener('orientationchange', scheduleViewportSync);
    window.addEventListener('pageshow', scheduleViewportSync);
    window.addEventListener('focus', scheduleViewportSync);
    window.screen?.orientation?.addEventListener?.('change', scheduleViewportSync);
    const observer =
      'ResizeObserver' in window ? new ResizeObserver(scheduleViewportSync) : null;
    observer?.observe(document.documentElement);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', scheduleViewportSync);
      window.removeEventListener('orientationchange', scheduleViewportSync);
      window.removeEventListener('pageshow', scheduleViewportSync);
      window.removeEventListener('focus', scheduleViewportSync);
      window.screen?.orientation?.removeEventListener?.('change', scheduleViewportSync);
      if (viewportTimerRef.current !== null) {
        window.clearTimeout(viewportTimerRef.current);
        viewportTimerRef.current = null;
      }
    };
  }, [isDisplayReady, openRequiredCheck]);

  useLayoutEffect(() => {
    if (!isGateOpen) return undefined;

    scheduleFitMeasurement();
    const observer =
      'ResizeObserver' in window ? new ResizeObserver(scheduleFitMeasurement) : null;
    if (frameRef.current) observer?.observe(frameRef.current);
    if (previewRef.current) observer?.observe(previewRef.current);

    return () => {
      observer?.disconnect();
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [isGateOpen, previewStyle, scheduleFitMeasurement, siteScale]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;

    if (isDisplayReady) {
      content.removeAttribute('inert');
      return undefined;
    }

    content.setAttribute('inert', '');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => {
      const firstControl = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      (firstControl ?? dialogRef.current)?.focus();
    });

    return () => {
      content.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
    };
  }, [isDisplayReady]);

  const adjustScale = (direction: -1 | 1) => {
    setDoesPreviewFit(false);
    setSiteScale((current) =>
      normalizeSiteScale(current + direction * SITE_SCALE_STEP),
    );
  };

  const selectRecommendedScale = () => {
    setDoesPreviewFit(false);
    setSiteScale(recommendedScale);
    window.requestAnimationFrame(scheduleFitMeasurement);
  };

  const handleContinue = () => {
    if (!isSecure || !doesPreviewFit) return;
    completeDisplayCheck(siteScale);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const dialog = dialogRef.current;
    const activeElement = document.activeElement;
    const isFocusInside = Boolean(activeElement && dialog?.contains(activeElement));
    if (
      event.shiftKey &&
      (!isFocusInside || activeElement === dialog || activeElement === first)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!isFocusInside || activeElement === last)) {
      event.preventDefault();
      first.focus();
    }
  };

  const percentageLabel = `${Math.round(siteScale * 100)}%`;

  return (
    <HomeDisplayReadyContext.Provider value={isDisplayReady}>
      <HomeDisplayScaleContext.Provider value={siteScale}>
        <main
          className={`${pageStyles.page} ${styles.displayRoot}`}
          data-home-standard-canvas="true"
          style={canvasStyle}
        >
          <div
            className={styles.canvasPositioner}
            data-display-ready={isDisplayReady ? 'true' : 'false'}
          >
            <div
              ref={contentRef}
              className={styles.homeContent}
              data-display-ready={isDisplayReady ? 'true' : 'false'}
              aria-hidden={isMounted && !isDisplayReady ? 'true' : undefined}
            >
              {children}
            </div>
          </div>

          {isMounted && isGateOpen ? (
            <div className={styles.backdrop} role="presentation">
              <div
                ref={dialogRef}
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="home-display-check-title"
                aria-describedby="home-display-check-description"
                tabIndex={-1}
                onKeyDown={handleDialogKeyDown}
              >
                <header className={styles.dialogHeader}>
                  <Image
                    className={styles.logo}
                    src="/brand/aim4price-mark-black.png"
                    alt=""
                    width={66}
                    height={52}
                    unoptimized
                  />
                  <div>
                    <h2 id="home-display-check-title">Display fit required</h2>
                    <p id="home-display-check-description">
                      Scale the complete Aim4price page to fit, then continue.
                    </p>
                  </div>
                </header>

                <p
                  className={styles.securityLine}
                  data-secure={isSecure ? 'true' : 'false'}
                >
                  <span aria-hidden="true">{isSecure ? '✓' : '!'}</span>
                  {isSecure ? 'Secure connection' : 'Secure connection required'}
                </p>

                <div className={styles.fitCanvas}>
                  <div
                    ref={frameRef}
                    className={styles.fitFrame}
                    data-fit={doesPreviewFit ? 'true' : 'false'}
                  >
                    <div
                      ref={previewRef}
                      className={styles.fitPreview}
                      style={previewStyle}
                      aria-hidden="true"
                    >
                      <div className={styles.previewTopline}>
                        <span>2023 Toyota Hilux</span>
                        <strong>R 237 150</strong>
                      </div>
                      <div className={styles.previewBody}>
                        <div className={styles.previewPhoto}>
                          <Image
                            src="/brand/home-asset-hilux-listing.webp"
                            alt=""
                            fill
                            sizes="180px"
                            unoptimized
                          />
                        </div>
                        <div className={styles.previewFacts}>
                          <span>YEAR <strong>2023</strong></span>
                          <span>USAGE <strong>113 677 km</strong></span>
                          <span>CONDITION <strong>Good</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.sizeControls}>
                  <button
                    type="button"
                    aria-label="Zoom the complete Aim4price page out"
                    onClick={() => adjustScale(-1)}
                    disabled={siteScale <= MIN_SITE_SCALE}
                  >
                    −
                  </button>
                  <p role="status" aria-live="polite" aria-atomic="true">
                    <strong>{percentageLabel}</strong>
                    <span>
                      {doesPreviewFit
                        ? 'Complete page fits the frame'
                        : 'Zoom out until the page fits'}
                    </span>
                  </p>
                  <button
                    type="button"
                    aria-label="Zoom the complete Aim4price page in"
                    onClick={() => adjustScale(1)}
                    disabled={siteScale >= MAX_SITE_SCALE}
                  >
                    +
                  </button>
                </div>

                {!isSecure ? (
                  <a className={styles.secureLink} href={secureHref}>
                    Open secure Aim4price
                  </a>
                ) : null}

                <footer className={styles.dialogFooter}>
                  <p>Required before entering Aim4price.</p>
                  <div>
                    <button
                      type="button"
                      className={styles.recommendedButton}
                      onClick={selectRecommendedScale}
                    >
                      Use recommended fit
                    </button>
                    <button
                      type="button"
                      className={styles.continueButton}
                      onClick={handleContinue}
                      disabled={!isSecure || !doesPreviewFit}
                    >
                      Continue to Aim4price
                    </button>
                  </div>
                </footer>
              </div>
            </div>
          ) : null}
        </main>
      </HomeDisplayScaleContext.Provider>
    </HomeDisplayReadyContext.Provider>
  );
}
