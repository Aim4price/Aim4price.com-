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

const DISPLAY_CHECK_QUERY =
  '(min-width: 1181px) and (min-height: 640px) and (hover: hover) and (pointer: fine)';
const DISPLAY_COMPLETED_KEY = 'aim4price:home-display-check:completed';
const DISPLAY_PREFERENCE_KEY = 'aim4price:home-display-preference:v2';
const LEGACY_DISPLAY_PREFERENCE_KEY = 'aim4price:home-display-preference:v1';
const LEGACY_DISPLAY_KEYS = [
  'aim4price:home-display-check:v2',
  'aim4price:home-display-check:v1',
] as const;
const DISPLAY_PREFERENCE_VERSION = 2;
const ORIGINAL_CANVAS_WIDTH = 1360;
const ORIGINAL_CANVAS_HEIGHT = 620;
const PREVIEW_SAFE_WIDTH_RATIO = 0.96;
const PREVIEW_SAFE_HEIGHT_RATIO = 0.9;

export const DISPLAY_SIZES = [
  { id: 'compact', label: 'Compact', scale: 0.78 },
  { id: 'original', label: 'Original', scale: 1 },
] as const;

type DisplaySize = (typeof DISPLAY_SIZES)[number]['id'];

type StoredDisplayPreference = {
  version: typeof DISPLAY_PREFERENCE_VERSION;
  selections: Partial<Record<DisplaySize, DisplaySize>>;
};

type ViewportSize = {
  width: number;
  height: number;
};

const HomeDisplayReadyContext = createContext(true);

export function useHomeDisplayReady() {
  return useContext(HomeDisplayReadyContext);
}

const isDisplaySize = (value: unknown): value is DisplaySize =>
  DISPLAY_SIZES.some(({ id }) => id === value);

const getViewportSize = (): ViewportSize => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const getPreviewRatios = (
  viewport: ViewportSize,
  scale: (typeof DISPLAY_SIZES)[number]['scale'],
) => ({
  width: (ORIGINAL_CANVAS_WIDTH * scale) / Math.max(1, viewport.width - 48),
  height: (ORIGINAL_CANVAS_HEIGHT * scale) / Math.max(1, viewport.height - 96),
});

const doesSizeFitViewport = (viewport: ViewportSize, size: DisplaySize) => {
  const option = DISPLAY_SIZES.find(({ id }) => id === size) ?? DISPLAY_SIZES[0];
  const ratios = getPreviewRatios(viewport, option.scale);
  return (
    ratios.width <= PREVIEW_SAFE_WIDTH_RATIO &&
    ratios.height <= PREVIEW_SAFE_HEIGHT_RATIO
  );
};

const getRecommendedSizeIndex = (viewport: ViewportSize) => {
  let recommendedIndex = 0;

  DISPLAY_SIZES.forEach((option, index) => {
    if (doesSizeFitViewport(viewport, option.id)) {
      recommendedIndex = index;
    }
  });

  return recommendedIndex;
};

const clampSizeIndex = (index: number) =>
  Math.max(0, Math.min(DISPLAY_SIZES.length - 1, index));

const getRecommendedSize = (viewport: ViewportSize): DisplaySize =>
  DISPLAY_SIZES[getRecommendedSizeIndex(viewport)]?.id ?? 'compact';

const getSizeIndex = (size: DisplaySize) =>
  Math.max(0, DISPLAY_SIZES.findIndex(({ id }) => id === size));

const createDisplayPreference = (
  selections: StoredDisplayPreference['selections'] = {},
): StoredDisplayPreference => ({
  version: DISPLAY_PREFERENCE_VERSION,
  selections,
});

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
  for (const getStorage of [
    () => window.localStorage,
    () => window.sessionStorage,
  ]) {
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
  try {
    window.localStorage.setItem(key, value);
    return;
  } catch {
    try {
      window.sessionStorage.setItem(key, value);
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
      // A storage restriction must never block the homepage.
    }
  }
};

const readStoredPreference = (): StoredDisplayPreference | null => {
  try {
    const raw = readStorageItem(DISPLAY_PREFERENCE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      version?: number;
      selections?: unknown;
    };
    if (
      parsed.version !== DISPLAY_PREFERENCE_VERSION ||
      !parsed.selections ||
      typeof parsed.selections !== 'object' ||
      Array.isArray(parsed.selections)
    ) {
      removeStorageItem(DISPLAY_PREFERENCE_KEY);
      return null;
    }

    const selections: StoredDisplayPreference['selections'] = {};
    const storedSelections = parsed.selections as Record<string, unknown>;
    for (const { id } of DISPLAY_SIZES) {
      const selectedSize = storedSelections[id];
      if (selectedSize === undefined) continue;
      if (!isDisplaySize(selectedSize)) {
        removeStorageItem(DISPLAY_PREFERENCE_KEY);
        return null;
      }
      selections[id] = selectedSize;
    }

    return createDisplayPreference(selections);
  } catch {
    return null;
  }
};

const readLegacyPreference = (
  viewport: ViewportSize,
): StoredDisplayPreference | null => {
  try {
    const raw = readStorageItem(LEGACY_DISPLAY_PREFERENCE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; offset?: unknown };
      if (parsed.version === 1 && (parsed.offset === -1 || parsed.offset === 0)) {
        const recommendedIndex = getRecommendedSizeIndex(viewport);
        const selectedIndex = clampSizeIndex(recommendedIndex + parsed.offset);
        const profile = getRecommendedSize(viewport);
        const selectedSize = DISPLAY_SIZES[selectedIndex]?.id ?? profile;
        return createDisplayPreference({ [profile]: selectedSize });
      }
    }
  } catch {
    // Continue to the display-check records used by earlier releases.
  }

  for (const key of LEGACY_DISPLAY_KEYS) {
    try {
      const raw = readStorageItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        version?: number;
        size?: unknown;
        density?: unknown;
        viewportClass?: unknown;
      };

      if (key.endsWith(':v2') && parsed.version === 2 && isDisplaySize(parsed.size)) {
        const profile =
          parsed.viewportClass === 'recommended-original'
            ? 'original'
            : parsed.viewportClass === 'recommended-compact'
              ? 'compact'
              : getRecommendedSize(viewport);
        return createDisplayPreference({ [profile]: parsed.size });
      }

      if (
        key.endsWith(':v1') &&
        parsed.version === 1 &&
        ['compact', 'balanced', 'spacious'].includes(String(parsed.density))
      ) {
        const profile = getRecommendedSize(viewport);
        const recommendedIndex = getRecommendedSizeIndex(viewport);
        const selectedIndex = clampSizeIndex(
          recommendedIndex + (parsed.density === 'compact' ? -1 : 0),
        );
        const selectedSize = DISPLAY_SIZES[selectedIndex]?.id ?? profile;
        return createDisplayPreference({ [profile]: selectedSize });
      }
    } catch {
      // Ignore malformed legacy data and continue to the next known format.
    }
  }

  return null;
};

const persistDisplayCompletion = (preference: StoredDisplayPreference) => {
  writeStorageItem(DISPLAY_COMPLETED_KEY, '1');
  writeStorageItem(DISPLAY_PREFERENCE_KEY, JSON.stringify(preference));
};

const readDisplayCompletion = (viewport: ViewportSize) => {
  const isCompleted = readStorageItem(DISPLAY_COMPLETED_KEY) === '1';
  const storedPreference = readStoredPreference();
  if (storedPreference) {
    if (!isCompleted) persistDisplayCompletion(storedPreference);
    return { completed: true, preference: storedPreference } as const;
  }

  const legacyPreference = readLegacyPreference(viewport);
  if (legacyPreference !== null) {
    persistDisplayCompletion(legacyPreference);
    return { completed: true, preference: legacyPreference } as const;
  }

  if (isCompleted) {
    const profile = getRecommendedSize(viewport);
    const recoveredPreference = createDisplayPreference({ [profile]: profile });
    persistDisplayCompletion(recoveredPreference);
    return { completed: true, preference: recoveredPreference } as const;
  }

  return { completed: false, preference: createDisplayPreference() } as const;
};

export default function HomeDisplayCheck({ children }: { children: ReactNode }) {
  const [sizeIndex, setSizeIndex] = useState(DISPLAY_SIZES.length - 1);
  const [viewport, setViewport] = useState<ViewportSize>({
    width: 1600,
    height: 900,
  });
  const [isMounted, setIsMounted] = useState(false);
  const [isGateOpen, setIsGateOpen] = useState(false);
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
  const displayPreferenceRef = useRef<StoredDisplayPreference>(
    createDisplayPreference(),
  );

  const size = DISPLAY_SIZES[sizeIndex] ?? DISPLAY_SIZES[1];
  const recommendedSizeIndex = useMemo(
    () => getRecommendedSizeIndex(viewport),
    [viewport],
  );

  const previewStyle = useMemo(() => {
    const ratios = getPreviewRatios(viewport, size.scale);

    return {
      '--display-preview-width': `${ratios.width * 100}%`,
      '--display-preview-height': `${ratios.height * 100}%`,
    } as CSSProperties;
  }, [size.scale, viewport.height, viewport.width]);

  const measurePreviewFit = useCallback(() => {
    const frame = frameRef.current?.getBoundingClientRect();
    const preview = previewRef.current?.getBoundingClientRect();
    if (!frame || !preview) {
      setDoesPreviewFit(false);
      return;
    }

    const safeInset = 6;
    setDoesPreviewFit(
      preview.left >= frame.left + safeInset &&
        preview.top >= frame.top + safeInset &&
        preview.right <= frame.right - safeInset &&
        preview.bottom <= frame.bottom - safeInset,
    );
  }, []);

  const scheduleFitMeasurement = useCallback(() => {
    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current);
    }

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null;
      measurePreviewFit();
    });
  }, [measurePreviewFit]);

  const acceptSize = useCallback((nextIndex: number) => {
    const nextViewport = getViewportSize();
    const profile = getRecommendedSize(nextViewport);
    const selectedSize = DISPLAY_SIZES[nextIndex]?.id ?? profile;
    const storedPreference = readStoredPreference();
    const preference = createDisplayPreference({
      ...displayPreferenceRef.current.selections,
      ...storedPreference?.selections,
      [profile]: selectedSize,
    });
    setSizeIndex(nextIndex);
    persistDisplayCompletion(preference);
    hasCompletedCheckRef.current = true;
    displayPreferenceRef.current = preference;
    setIsGateOpen(false);
    setIsDisplayReady(true);

    window.requestAnimationFrame(() => {
      document.getElementById('home-hero-title')?.focus();
    });
  }, []);

  useEffect(() => {
    setIsMounted(true);
    const desktopMedia = window.matchMedia(DISPLAY_CHECK_QUERY);

    const syncCapability = () => {
      const nextViewport = getViewportSize();
      const nextIsSecure = hasSecureConnection();
      const completion = readDisplayCompletion(nextViewport);
      const profile = getRecommendedSize(nextViewport);
      const savedSize = completion.preference.selections[profile];

      setViewport(nextViewport);
      setIsSecure(nextIsSecure);
      setSecureHref(getSecureHref());
      hasCompletedCheckRef.current = completion.completed;
      displayPreferenceRef.current = completion.preference;

      if (!desktopMedia.matches) {
        setIsGateOpen(false);
        setIsDisplayReady(true);
        return;
      }

      if (
        completion.completed &&
        savedSize &&
        doesSizeFitViewport(nextViewport, savedSize)
      ) {
        setSizeIndex(getSizeIndex(savedSize));
        setIsGateOpen(false);
        setIsDisplayReady(true);
        return;
      }

      setSizeIndex(getRecommendedSizeIndex(nextViewport));
      setDoesPreviewFit(false);
      setIsDisplayReady(false);
      setIsGateOpen(true);
    };

    syncCapability();
    desktopMedia.addEventListener('change', syncCapability);
    window.addEventListener('storage', syncCapability);
    return () => {
      desktopMedia.removeEventListener('change', syncCapability);
      window.removeEventListener('storage', syncCapability);
    };
  }, []);

  useEffect(() => {
    const syncViewport = () => {
      const nextViewport = getViewportSize();
      setViewport(nextViewport);

      if (
        !isDisplayReady ||
        !hasCompletedCheckRef.current ||
        !window.matchMedia(DISPLAY_CHECK_QUERY).matches
      ) {
        return;
      }

      const profile = getRecommendedSize(nextViewport);
      const savedSize = displayPreferenceRef.current.selections[profile];

      if (!savedSize || !doesSizeFitViewport(nextViewport, savedSize)) {
        setSizeIndex(getRecommendedSizeIndex(nextViewport));
        setDoesPreviewFit(false);
        setIsDisplayReady(false);
        setIsGateOpen(true);
        return;
      }

      setSizeIndex(getSizeIndex(savedSize));
    };

    const scheduleViewportSync = () => {
      if (viewportTimerRef.current !== null) {
        window.clearTimeout(viewportTimerRef.current);
      }

      viewportTimerRef.current = window.setTimeout(() => {
        viewportTimerRef.current = null;
        syncViewport();
      }, 160);
    };

    window.addEventListener('resize', scheduleViewportSync, { passive: true });
    window.addEventListener('orientationchange', scheduleViewportSync);
    window.addEventListener('pageshow', scheduleViewportSync);
    window.addEventListener('focus', scheduleViewportSync);
    const observer =
      'ResizeObserver' in window ? new ResizeObserver(scheduleViewportSync) : null;
    observer?.observe(document.documentElement);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', scheduleViewportSync);
      window.removeEventListener('orientationchange', scheduleViewportSync);
      window.removeEventListener('pageshow', scheduleViewportSync);
      window.removeEventListener('focus', scheduleViewportSync);
      if (viewportTimerRef.current !== null) {
        window.clearTimeout(viewportTimerRef.current);
        viewportTimerRef.current = null;
      }
    };
  }, [isDisplayReady]);

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
  }, [isGateOpen, previewStyle, scheduleFitMeasurement, sizeIndex]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;

    if (!isGateOpen) {
      content.removeAttribute('inert');
      return undefined;
    }

    content.setAttribute('inert', '');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      content.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
    };
  }, [isGateOpen]);

  const adjustSize = (direction: -1 | 1) => {
    setDoesPreviewFit(false);
    setSizeIndex((current) =>
      Math.max(0, Math.min(DISPLAY_SIZES.length - 1, current + direction)),
    );
  };

  const useRecommendedSize = () => {
    if (!isSecure) return;
    acceptSize(recommendedSizeIndex);
  };

  const handleContinue = () => {
    if (!isSecure || !doesPreviewFit) return;
    acceptSize(sizeIndex);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      useRecommendedSize();
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
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <HomeDisplayReadyContext.Provider value={isDisplayReady}>
      <main
        className={`${pageStyles.page} ${styles.displayRoot}`}
        data-home-display-size={size.id}
      >
        <div
          ref={contentRef}
          className={styles.homeContent}
          aria-hidden={isGateOpen ? 'true' : undefined}
        >
          {children}
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
                  <h2 id="home-display-check-title">Quick display check</h2>
                  <p id="home-display-check-description">
                    Use − or + until the card sits inside the frame.
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
                  aria-label="Make Aim4price smaller"
                  onClick={() => adjustSize(-1)}
                  disabled={sizeIndex === 0}
                >
                  −
                </button>
                <p role="status" aria-live="polite" aria-atomic="true">
                  <strong>{size.label}</strong>
                  <span>
                    {doesPreviewFit ? 'Card fits the frame' : 'Choose a smaller size'}
                  </span>
                </p>
                <button
                  type="button"
                  aria-label="Make Aim4price larger"
                  onClick={() => adjustSize(1)}
                  disabled={sizeIndex === DISPLAY_SIZES.length - 1}
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
                <p>Saved for this display setup.</p>
                <div>
                  <button
                    type="button"
                    className={styles.recommendedButton}
                    onClick={useRecommendedSize}
                    disabled={!isSecure}
                  >
                    Use recommended
                  </button>
                  <button
                    type="button"
                    className={styles.continueButton}
                    onClick={handleContinue}
                    disabled={!isSecure || !doesPreviewFit}
                  >
                    Continue
                  </button>
                </div>
              </footer>
            </div>
          </div>
        ) : null}
      </main>
    </HomeDisplayReadyContext.Provider>
  );
}
