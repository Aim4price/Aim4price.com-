'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import styles from './SiteWorkspaceZoom.module.css';

const STORAGE_KEY = 'aim4price.site.workspace-zoom.v1';
const ZOOM_MODE_STORAGE_KEY = 'aim4price.site.workspace-zoom-mode.v1';
const INTRO_STORAGE_KEY = 'aim4price.site.workspace-zoom-intro.v1';
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 70;
const MAX_ZOOM = 150;
const ZOOM_STEP = 10;
const AUTO_BASE_WINDOW_WIDTH = 1440;
const AUTO_MAX_WINDOW_WIDTH = 3840;
const AUTO_MAX_ZOOM = 140;
const INTRO_DELAY_MS = 900;
const INTRO_DURATION_MS = 5200;
const EXCLUDED_ROUTE_PREFIXES = ['/owner-app', '/dealer', '/field-manager', '/admin'] as const;

type SiteZoomMode = 'workspace' | 'viewport';
type ZoomPreferenceMode = 'auto' | 'manual';

type SavedZoomPreference = {
  mode: ZoomPreferenceMode;
  zoom: number;
};

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value)));
}

function readWindowWidth(): number {
  const outerWidth = Number(window.outerWidth);
  if (Number.isFinite(outerWidth) && outerWidth > 0) return outerWidth;

  const documentWidth = Number(document.documentElement.clientWidth);
  if (Number.isFinite(documentWidth) && documentWidth > 0) return documentWidth;

  return AUTO_BASE_WINDOW_WIDTH;
}

function calculateAutoZoom(windowWidth: number): number {
  if (!Number.isFinite(windowWidth) || windowWidth <= AUTO_BASE_WINDOW_WIDTH) {
    return DEFAULT_ZOOM;
  }

  const progress = Math.max(
    0,
    Math.min(
      1,
      (windowWidth - AUTO_BASE_WINDOW_WIDTH)
        / (AUTO_MAX_WINDOW_WIDTH - AUTO_BASE_WINDOW_WIDTH),
    ),
  );

  // One continuous ease-out curve replaces monitor-size tiers. It grows
  // quickly enough to make a 1080p external monitor feel substantial, then
  // tapers toward the cap so very large windows do not become oversized.
  const easedProgress = Math.sqrt(progress);
  return clampZoom(
    DEFAULT_ZOOM + (AUTO_MAX_ZOOM - DEFAULT_ZOOM) * easedProgress,
  );
}

function routeMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isExcludedRoute(pathname: string): boolean {
  return EXCLUDED_ROUTE_PREFIXES.some((prefix) => routeMatchesPrefix(pathname, prefix));
}

function siteZoomMode(pathname: string): SiteZoomMode {
  // Home owns a long viewport-relative sticky scroll story. Giving its page
  // host overflow would turn that host into the sticky containing scroller.
  // Keep Home on window/document scrolling while ordinary workspaces retain
  // their contained horizontal overflow.
  return pathname === '/' ? 'viewport' : 'workspace';
}

function readSavedPreference(): SavedZoomPreference {
  const automaticZoom = calculateAutoZoom(readWindowWidth());

  try {
    const savedMode = window.localStorage.getItem(ZOOM_MODE_STORAGE_KEY);
    const savedZoomValue = window.localStorage.getItem(STORAGE_KEY);
    const savedZoom = savedZoomValue ? clampZoom(Number(savedZoomValue)) : DEFAULT_ZOOM;

    if (savedMode === 'manual') {
      return { mode: 'manual', zoom: savedZoom };
    }

    if (savedMode === 'auto') {
      return { mode: 'auto', zoom: automaticZoom };
    }

    // Existing Aim4price users may already have a non-100% zoom saved from
    // before Auto sizing existed. Preserve that explicit choice. A missing or
    // 100% legacy value becomes Auto so normal users get the new display fit.
    if (savedZoomValue && savedZoom !== DEFAULT_ZOOM) {
      return { mode: 'manual', zoom: savedZoom };
    }

    return { mode: 'auto', zoom: automaticZoom };
  } catch {
    return { mode: 'auto', zoom: automaticZoom };
  }
}

function hasSeenIntro(): boolean {
  try {
    return window.localStorage.getItem(INTRO_STORAGE_KEY) === 'seen';
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    window.localStorage.setItem(INTRO_STORAGE_KEY, 'seen');
  } catch {
    // The hint can safely repeat in a future visit when storage is blocked.
  }
}

export default function SiteWorkspaceZoom({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const controlHostRef = useRef<HTMLElement | null>(null);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const zoomModeRef = useRef<ZoomPreferenceMode>('auto');
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [zoomMode, setZoomMode] = useState<ZoomPreferenceMode>('auto');
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [controlHost, setControlHost] = useState<HTMLElement | null>(null);
  const [showIntro, setShowIntro] = useState(false);

  const clearBoundHost = useCallback(() => {
    const host = hostRef.current;
    const header = headerRef.current;

    if (host) {
      delete host.dataset.aim4priceSiteZoomHost;
      delete host.dataset.aim4priceSiteZoomMode;
      host.style.removeProperty('--aim4price-site-workspace-zoom');
    }

    if (header) {
      delete header.dataset.aim4priceAppHeader;
    }

    hostRef.current = null;
    headerRef.current = null;
    controlHostRef.current = null;
    setControlHost(null);
    setShowIntro(false);
  }, []);

  const bindCurrentPage = useCallback((): boolean => {
    const root = rootRef.current;
    if (!root || isExcludedRoute(pathname)) return false;

    const brandLink = root.querySelector<HTMLAnchorElement>('a[aria-label="Go to Aim4price home"]');
    const header = brandLink?.closest<HTMLElement>('header') ?? null;
    const host = header?.parentElement ?? null;
    const headerInner = header?.firstElementChild;
    const headerActions = headerInner?.lastElementChild;

    if (
      !header
      || !host
      || !root.contains(host)
      || !(headerActions instanceof HTMLElement)
    ) {
      return false;
    }

    if (hostRef.current !== host || headerRef.current !== header) {
      clearBoundHost();
      hostRef.current = host;
      headerRef.current = header;
    }

    if (controlHostRef.current !== headerActions) {
      controlHostRef.current = headerActions;
      setControlHost(headerActions);
    }

    header.dataset.aim4priceAppHeader = 'true';
    host.dataset.aim4priceSiteZoomHost = 'true';
    host.dataset.aim4priceSiteZoomMode = siteZoomMode(pathname);
    host.style.setProperty('--aim4price-site-workspace-zoom', String(zoomRef.current / 100));
    setIsAvailable(true);
    return true;
  }, [clearBoundHost, pathname]);

  const applyZoom = useCallback((nextZoom: number) => {
    const normalizedZoom = clampZoom(nextZoom);
    const host = hostRef.current;
    const usesContainedScroll = host?.dataset.aim4priceSiteZoomMode === 'workspace';
    const previousScrollWidth = usesContainedScroll ? host.scrollWidth : 0;
    const previousCenter = usesContainedScroll && previousScrollWidth > 0
      ? (host.scrollLeft + host.clientWidth / 2) / previousScrollWidth
      : 0;

    if (normalizedZoom === zoomRef.current) {
      host?.style.setProperty('--aim4price-site-workspace-zoom', String(normalizedZoom / 100));
      return;
    }

    zoomRef.current = normalizedZoom;
    host?.style.setProperty('--aim4price-site-workspace-zoom', String(normalizedZoom / 100));
    setZoom(normalizedZoom);

    if (!host || !usesContainedScroll || previousScrollWidth <= 0) return;

    window.requestAnimationFrame(() => {
      if (!host.isConnected) return;
      const nextScrollWidth = host.scrollWidth;
      const desiredLeft = previousCenter * nextScrollWidth - host.clientWidth / 2;
      host.scrollLeft = Math.max(0, desiredLeft);
    });
  }, []);

  const changeZoom = useCallback((nextZoom: number) => {
    setShowIntro(false);
    zoomModeRef.current = 'manual';
    setZoomMode('manual');
    applyZoom(nextZoom);
  }, [applyZoom]);

  const enableAutoZoom = useCallback(() => {
    setShowIntro(false);
    zoomModeRef.current = 'auto';
    setZoomMode('auto');
    applyZoom(calculateAutoZoom(readWindowWidth()));
  }, [applyZoom]);

  useLayoutEffect(() => {
    const preference = readSavedPreference();
    zoomRef.current = preference.zoom;
    zoomModeRef.current = preference.mode;
    setZoom(preference.zoom);
    setZoomMode(preference.mode);
    setHasLoadedPreference(true);
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
    hostRef.current?.style.setProperty('--aim4price-site-workspace-zoom', String(zoom / 100));

    if (!hasLoadedPreference) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, String(zoom));
      window.localStorage.setItem(ZOOM_MODE_STORAGE_KEY, zoomMode);
    } catch {
      // The control still works for the current session when storage is blocked.
    }
  }, [hasLoadedPreference, zoom, zoomMode]);

  useLayoutEffect(() => {
    clearBoundHost();
    setIsAvailable(false);

    if (isExcludedRoute(pathname)) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      bindCurrentPage();
    });

    const root = rootRef.current;
    if (!root) return () => window.cancelAnimationFrame(frameId);

    const observer = new MutationObserver(() => {
      if (
        hostRef.current?.isConnected
        && headerRef.current?.isConnected
        && controlHostRef.current?.isConnected
      ) {
        return;
      }
      bindCurrentPage();
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      clearBoundHost();
    };
  }, [bindCurrentPage, clearBoundHost, pathname]);

  useEffect(() => {
    if (!hasLoadedPreference || isExcludedRoute(pathname)) return undefined;

    const syncWindowSizing = () => {
      // Auto sizing only controls perceived size. Layout selection remains a
      // CSS concern, so moving the same browser window between displays does
      // not introduce another family of responsive endpoint states.
      if (zoomModeRef.current === 'auto') {
        applyZoom(calculateAutoZoom(readWindowWidth()));
      }
    };

    syncWindowSizing();
    window.addEventListener('resize', syncWindowSizing);
    window.addEventListener('orientationchange', syncWindowSizing);

    return () => {
      window.removeEventListener('resize', syncWindowSizing);
      window.removeEventListener('orientationchange', syncWindowSizing);
    };
  }, [applyZoom, hasLoadedPreference, pathname]);

  useEffect(() => {
    setShowIntro(false);

    if (
      pathname !== '/'
      || !isAvailable
      || !controlHost
      || !hasLoadedPreference
      || hasSeenIntro()
    ) {
      return undefined;
    }

    let hideTimer: number | null = null;
    const showTimer = window.setTimeout(() => {
      setShowIntro(true);
      markIntroSeen();
      hideTimer = window.setTimeout(() => setShowIntro(false), INTRO_DURATION_MS);
    }, INTRO_DELAY_MS);

    return () => {
      window.clearTimeout(showTimer);
      if (hideTimer !== null) window.clearTimeout(hideTimer);
    };
  }, [controlHost, hasLoadedPreference, isAvailable, pathname]);

  const zoomValueLabel = zoomMode === 'auto'
    ? `Automatic page size ${zoom} percent.`
    : `Page size ${zoom} percent. Return to automatic sizing.`;

  const controls = isAvailable ? (
    <div
      className={`${styles.controls} ${showIntro ? styles.controlsIntro : ''}`}
      role="toolbar"
      aria-label="Aim4price page size controls"
      data-site-workspace-zoom-controls
      data-zoom-preference={zoomMode}
    >
      <button
        type="button"
        className={styles.zoomButton}
        onClick={() => changeZoom(zoom - ZOOM_STEP)}
        disabled={zoom <= MIN_ZOOM}
        aria-label="Zoom out"
        data-tooltip="Zoom out"
      >
        −
      </button>

      <button
        type="button"
        className={styles.zoomValue}
        onClick={enableAutoZoom}
        aria-label={zoomValueLabel}
        title={zoomMode === 'auto' ? 'Page size is automatic' : 'Return to automatic page size'}
      >
        {zoom}%
      </button>

      <button
        type="button"
        className={styles.zoomButton}
        onClick={() => changeZoom(zoom + ZOOM_STEP)}
        disabled={zoom >= MAX_ZOOM}
        aria-label="Zoom in"
        data-tooltip="Zoom in"
      >
        +
      </button>

      {showIntro ? (
        <span className={styles.introNote} role="status">
          Page size adjusts automatically. Use − or + if needed.
        </span>
      ) : null}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={styles.root} data-site-workspace-zoom-root>
      {children}
      {controlHost && controls ? createPortal(controls, controlHost) : null}
    </div>
  );
}
