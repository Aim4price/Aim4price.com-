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
const DISPLAY_STORAGE_KEY = 'aim4price:home-display-check:v1';
const DISPLAY_STORAGE_VERSION = 1;
const DISPLAY_CANVAS_WIDTH = 1360;
const DISPLAY_CANVAS_HEIGHT = 780;
const VIEWPORT_WIDTH_BUCKET = 160;
const VIEWPORT_HEIGHT_BUCKET = 120;

export const DISPLAY_DENSITIES = [
  { id: 'compact', label: 'Compact', fitScale: 0.58 },
  { id: 'balanced', label: 'Balanced', fitScale: 0.88 },
  { id: 'spacious', label: 'Spacious', fitScale: 1.08 },
] as const;

type DisplayDensity = (typeof DISPLAY_DENSITIES)[number]['id'];

type StoredDisplayCheck = {
  version: typeof DISPLAY_STORAGE_VERSION;
  density: DisplayDensity;
  viewportSignature: string;
  completedAt: string;
};

type ViewportSize = {
  width: number;
  height: number;
};

type SecurityStatus = 'checking' | 'protected' | 'local-development' | 'insecure';

const HomeDisplayReadyContext = createContext(true);

export function useHomeDisplayReady() {
  return useContext(HomeDisplayReadyContext);
}

const isDisplayDensity = (value: unknown): value is DisplayDensity =>
  DISPLAY_DENSITIES.some(({ id }) => id === value);

const getViewportSize = (): ViewportSize => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const getViewportSignature = ({ width, height }: ViewportSize) =>
  `${Math.round(width / VIEWPORT_WIDTH_BUCKET) * VIEWPORT_WIDTH_BUCKET}x${
    Math.round(height / VIEWPORT_HEIGHT_BUCKET) * VIEWPORT_HEIGHT_BUCKET
  }`;

const getRecommendedDensityIndex = ({ width, height }: ViewportSize) => {
  const safeWidth = Math.max(1, width - 48) * 0.92;
  const safeHeight = Math.max(1, height - 108) * 0.92;
  let recommendedIndex = 0;

  DISPLAY_DENSITIES.forEach((option, index) => {
    if (
      DISPLAY_CANVAS_WIDTH * option.fitScale <= safeWidth &&
      DISPLAY_CANVAS_HEIGHT * option.fitScale <= safeHeight
    ) {
      recommendedIndex = index;
    }
  });

  return recommendedIndex;
};

const getSecurityStatus = (): SecurityStatus => {
  if (window.location.protocol === 'https:' && window.isSecureContext) {
    return 'protected';
  }

  const isLocalDevelopment =
    window.isSecureContext &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  return isLocalDevelopment ? 'local-development' : 'insecure';
};

const readStoredDisplayCheck = (): StoredDisplayCheck | null => {
  try {
    const raw = window.localStorage.getItem(DISPLAY_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredDisplayCheck>;
    if (
      parsed.version !== DISPLAY_STORAGE_VERSION ||
      !isDisplayDensity(parsed.density) ||
      typeof parsed.viewportSignature !== 'string' ||
      typeof parsed.completedAt !== 'string'
    ) {
      window.localStorage.removeItem(DISPLAY_STORAGE_KEY);
      return null;
    }

    return parsed as StoredDisplayCheck;
  } catch {
    return null;
  }
};

const writeStoredDisplayCheck = (
  density: DisplayDensity,
  viewportSignature: string,
) => {
  try {
    const value: StoredDisplayCheck = {
      version: DISPLAY_STORAGE_VERSION,
      density,
      viewportSignature,
      completedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private or restricted browsing. The check
    // still completes safely; it will simply be offered again next time.
  }
};

const removeStoredDisplayCheck = () => {
  try {
    window.localStorage.removeItem(DISPLAY_STORAGE_KEY);
  } catch {
    // A storage restriction must never prevent the visitor from continuing.
  }
};

export default function HomeDisplayCheck({ children }: { children: ReactNode }) {
  const [densityIndex, setDensityIndex] = useState(DISPLAY_DENSITIES.length - 1);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 1600, height: 900 });
  const [isMounted, setIsMounted] = useState(false);
  const [isGateOpen, setIsGateOpen] = useState(false);
  const [isDisplayReady, setIsDisplayReady] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>('checking');
  const [doesPreviewFit, setDoesPreviewFit] = useState(false);
  const [secureHref, setSecureHref] = useState('https://www.aim4price.com/');

  const contentRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const smallerButtonRef = useRef<HTMLButtonElement | null>(null);
  const acceptedViewportRef = useRef<string | null>(null);
  const resizeFrameRef = useRef<number | null>(null);

  const density = DISPLAY_DENSITIES[densityIndex] ?? DISPLAY_DENSITIES[1];
  const recommendedDensityIndex = useMemo(
    () => getRecommendedDensityIndex(viewport),
    [viewport],
  );
  const securityPassed =
    securityStatus === 'protected' || securityStatus === 'local-development';
  const canContinue = securityPassed && doesPreviewFit;

  const previewDimensions = useMemo(() => {
    const availableWidth = Math.max(1, viewport.width - 48);
    const availableHeight = Math.max(1, viewport.height - 108);

    return {
      width: `${(DISPLAY_CANVAS_WIDTH * density.fitScale * 100) / availableWidth}%`,
      height: `${(DISPLAY_CANVAS_HEIGHT * density.fitScale * 100) / availableHeight}%`,
    };
  }, [density.fitScale, viewport.height, viewport.width]);

  const previewStyle = {
    '--display-preview-width': previewDimensions.width,
    '--display-preview-height': previewDimensions.height,
  } as CSSProperties;

  const measurePreviewFit = useCallback(() => {
    const frame = frameRef.current?.getBoundingClientRect();
    const preview = previewRef.current?.getBoundingClientRect();
    if (!frame || !preview) {
      setDoesPreviewFit(false);
      return;
    }

    const safeInset = 8;
    const fits =
      preview.left >= frame.left + safeInset &&
      preview.top >= frame.top + safeInset &&
      preview.right <= frame.right - safeInset &&
      preview.bottom <= frame.bottom - safeInset &&
      preview.width <= frame.width - safeInset * 2 &&
      preview.height <= frame.height - safeInset * 2;

    setDoesPreviewFit(fits);
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

  useEffect(() => {
    setIsMounted(true);
    const desktopMedia = window.matchMedia(DISPLAY_CHECK_QUERY);

    const syncCapability = () => {
      const nextViewport = getViewportSize();
      const nextSignature = getViewportSignature(nextViewport);
      const nextSecurityStatus = getSecurityStatus();
      const nextSecurityPassed =
        nextSecurityStatus === 'protected' ||
        nextSecurityStatus === 'local-development';

      setViewport(nextViewport);
      setSecurityStatus(nextSecurityStatus);
      setSecureHref(() => {
        try {
          const url = new URL(window.location.href);
          url.protocol = 'https:';
          return url.toString();
        } catch {
          return 'https://www.aim4price.com/';
        }
      });

      if (!desktopMedia.matches) {
        setIsGateOpen(false);
        setIsDisplayReady(true);
        return;
      }

      const stored = readStoredDisplayCheck();
      if (nextSecurityPassed && stored) {
        const storedIndex = DISPLAY_DENSITIES.findIndex(({ id }) => id === stored.density);
        const recommendedIndex = getRecommendedDensityIndex(nextViewport);
        const nextIndex = Math.min(
          storedIndex >= 0 ? storedIndex : recommendedIndex,
          recommendedIndex,
        );
        setDensityIndex(nextIndex);
        writeStoredDisplayCheck(DISPLAY_DENSITIES[nextIndex].id, nextSignature);
        acceptedViewportRef.current = nextSignature;
        setIsGateOpen(false);
        setIsDisplayReady(true);
        return;
      }

      if (stored) removeStoredDisplayCheck();
      acceptedViewportRef.current = null;
      setDensityIndex(
        Math.min(
          DISPLAY_DENSITIES.length - 1,
          getRecommendedDensityIndex(nextViewport) + 1,
        ),
      );
      setDoesPreviewFit(false);
      setIsDisplayReady(false);
      setIsGateOpen(true);
    };

    syncCapability();
    desktopMedia.addEventListener('change', syncCapability);

    return () => desktopMedia.removeEventListener('change', syncCapability);
  }, []);

  useEffect(() => {
    if (!isMounted) return undefined;

    const handleViewportChange = () => {
      const nextViewport = getViewportSize();
      const nextSignature = getViewportSignature(nextViewport);
      const supportsDisplayCheck = window.matchMedia(DISPLAY_CHECK_QUERY).matches;
      setViewport(nextViewport);

      if (!supportsDisplayCheck) {
        setIsGateOpen(false);
        setIsDisplayReady(true);
        return;
      }

      if (isDisplayReady && acceptedViewportRef.current) {
        const recommendedIndex = getRecommendedDensityIndex(nextViewport);
        const nextIndex = Math.min(densityIndex, recommendedIndex);
        if (nextIndex !== densityIndex) setDensityIndex(nextIndex);
        acceptedViewportRef.current = nextSignature;
        writeStoredDisplayCheck(DISPLAY_DENSITIES[nextIndex].id, nextSignature);
      }
    };

    window.addEventListener('resize', handleViewportChange, { passive: true });
    return () => window.removeEventListener('resize', handleViewportChange);
  }, [densityIndex, isDisplayReady, isMounted]);

  useLayoutEffect(() => {
    if (!isGateOpen) return undefined;

    scheduleFitMeasurement();
    const frame = frameRef.current;
    const preview = previewRef.current;
    const observer =
      'ResizeObserver' in window ? new ResizeObserver(scheduleFitMeasurement) : null;
    if (frame) observer?.observe(frame);
    if (preview) observer?.observe(preview);

    let disposed = false;
    if ('fonts' in document) {
      void document.fonts.ready.then(() => {
        if (!disposed) scheduleFitMeasurement();
      });
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [densityIndex, isGateOpen, previewDimensions.height, previewDimensions.width, scheduleFitMeasurement]);

  useEffect(() => {
    const content = contentRef.current;
    const dialog = dialogRef.current;
    if (!content) return undefined;

    if (!isGateOpen) {
      content.removeAttribute('inert');
      return undefined;
    }

    const inertedNodes: Array<{ element: HTMLElement; wasInert: boolean }> = [];
    let activeBranch: HTMLElement | null = dialog;
    while (activeBranch) {
      const parent = activeBranch.parentElement;
      if (!parent || parent === document.body) break;
      Array.from(parent.children).forEach((sibling) => {
        if (sibling !== activeBranch && sibling instanceof HTMLElement) {
          inertedNodes.push({ element: sibling, wasInert: sibling.hasAttribute('inert') });
          sibling.setAttribute('inert', '');
        }
      });
      activeBranch = parent;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      inertedNodes.forEach(({ element, wasInert }) => {
        if (!wasInert) element.removeAttribute('inert');
      });
      document.body.style.overflow = previousOverflow;
    };
  }, [isGateOpen]);

  const adjustDensity = (direction: -1 | 1) => {
    setDoesPreviewFit(false);
    setDensityIndex((current) =>
      Math.max(0, Math.min(DISPLAY_DENSITIES.length - 1, current + direction)),
    );
  };

  const useRecommendedDensity = () => {
    const recommendedIndex = getRecommendedDensityIndex(getViewportSize());
    setDoesPreviewFit(false);
    setDensityIndex(recommendedIndex);
    window.requestAnimationFrame(scheduleFitMeasurement);
  };

  const handleContinue = () => {
    if (!canContinue) return;

    const signature = getViewportSignature(getViewportSize());
    writeStoredDisplayCheck(density.id, signature);
    acceptedViewportRef.current = signature;
    setIsGateOpen(false);
    setIsDisplayReady(true);

    window.requestAnimationFrame(() => {
      document.getElementById('home-hero-title')?.focus();
    });
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
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
        data-home-display-density={density.id}
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
              <div className={styles.dialogHeader}>
                <div className={styles.securityMark} aria-hidden="true">
                  <Image
                    src="/brand/aim4price-mark-black.png"
                    alt=""
                    width={66}
                    height={52}
                    unoptimized
                  />
                </div>
                <div>
                  <p className={styles.eyebrow}>Aim4price protected setup</p>
                  <h2 id="home-display-check-title">Aim4price security &amp; display check</h2>
                  <p id="home-display-check-description">
                    Aim4price verifies this page is using a protected browser context, then
                    makes sure important asset information fits your screen correctly.
                  </p>
                </div>
              </div>

              <div className={styles.statusGrid}>
                <div className={styles.statusItem} data-passed={securityPassed ? 'true' : 'false'}>
                  <span className={styles.statusIcon} aria-hidden="true">
                    {securityPassed ? '✓' : '!'}
                  </span>
                  <span>
                    <strong>
                      {securityStatus === 'protected'
                        ? 'Connection protected'
                        : securityStatus === 'local-development'
                          ? 'Local development context'
                          : 'Secure connection required'}
                    </strong>
                    <small>
                      {securityStatus === 'protected'
                        ? 'This page is using HTTPS in a protected browser context.'
                        : securityStatus === 'local-development'
                          ? 'Browser-authorized local context. Production still requires HTTPS.'
                          : 'Open Aim4price over HTTPS to continue.'}
                    </small>
                  </span>
                </div>

                <div className={styles.statusItem} data-passed={doesPreviewFit ? 'true' : 'false'}>
                  <span className={styles.statusIcon} aria-hidden="true">
                    {doesPreviewFit ? '✓' : '2'}
                  </span>
                  <span>
                    <strong>{doesPreviewFit ? 'Display verified' : 'Display fit'}</strong>
                    <small>{doesPreviewFit ? 'Aim4price is ready for this screen.' : 'Adjust the preview below.'}</small>
                  </span>
                </div>
              </div>

              <section className={styles.fitSection} aria-labelledby="display-fit-title">
                <div className={styles.fitHeading}>
                  <div>
                    <h3 id="display-fit-title">Fit the complete asset card inside the frame</h3>
                    <p>Use − and + until all four edges sit within the green outline.</p>
                  </div>
                  <span className={styles.densityLabel}>{density.label}</span>
                </div>

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
                        <span>2023 Toyota Hilux Single Cab</span>
                        <strong>R 237 150</strong>
                      </div>
                      <div className={styles.previewBody}>
                        <div className={styles.previewPhoto} aria-hidden="true">
                          <Image
                            src="/brand/home-asset-hilux-listing.webp"
                            alt=""
                            fill
                            sizes="20rem"
                            unoptimized
                          />
                          <span>Aim4price asset</span>
                        </div>
                        <div className={styles.previewFacts} aria-hidden="true">
                          <span>YEAR <strong>2023</strong></span>
                          <span>USAGE <strong>113 677 km</strong></span>
                          <span>CONDITION <strong>Good</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.densityControls}>
                  <button
                    ref={smallerButtonRef}
                    type="button"
                    className={styles.densityButton}
                    aria-label="Make display smaller"
                    onClick={() => adjustDensity(-1)}
                    disabled={densityIndex === 0}
                  >
                    −
                  </button>
                  <p role="status" aria-live="polite" aria-atomic="true">
                    <strong>Display size: {density.label}</strong>
                    <span>
                      {doesPreviewFit
                        ? 'The complete card is inside the frame.'
                        : 'The card still extends beyond the frame.'}
                    </span>
                  </p>
                  <button
                    type="button"
                    className={styles.densityButton}
                    aria-label="Make display larger"
                    onClick={() => adjustDensity(1)}
                    disabled={densityIndex === DISPLAY_DENSITIES.length - 1}
                  >
                    +
                  </button>
                </div>
              </section>

              <div className={styles.dialogFooter}>
                <p>
                  Your display preference is stored only in this browser. This check does not
                  inspect personal files or identify your device.
                </p>
                <div className={styles.footerActions}>
                  {!securityPassed ? (
                    <a className={styles.secureLink} href={secureHref}>
                      Open secure Aim4price
                    </a>
                  ) : densityIndex !== recommendedDensityIndex ? (
                    <button type="button" className={styles.recommendedButton} onClick={useRecommendedDensity}>
                      Use recommended size
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.continueButton}
                    disabled={!canContinue}
                    onClick={handleContinue}
                  >
                    Continue to Aim4price
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </HomeDisplayReadyContext.Provider>
  );
}
