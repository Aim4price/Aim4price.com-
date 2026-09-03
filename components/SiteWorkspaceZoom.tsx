'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import styles from './SiteWorkspaceZoom.module.css';

const STORAGE_KEY = 'aim4price.site.workspace-zoom.v1';
const INTRO_STORAGE_KEY = 'aim4price.site.workspace-zoom-intro.v1';
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 70;
const MAX_ZOOM = 150;
const ZOOM_STEP = 10;
const INTRO_DELAY_MS = 900;
const INTRO_DURATION_MS = 5200;
const EXCLUDED_ROUTE_PREFIXES = ['/owner-app', '/dealer', '/field-manager', '/admin'] as const;

type SiteZoomMode = 'workspace' | 'viewport';

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value)));
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

function readSavedZoom(): number {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_ZOOM;
    return clampZoom(Number(saved));
  } catch {
    return DEFAULT_ZOOM;
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
  const controlHostRef = useRef<HTMLSpanElement | null>(null);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [controlHost, setControlHost] = useState<HTMLSpanElement | null>(null);
  const [showIntro, setShowIntro] = useState(false);

  const clearBoundHost = useCallback(() => {
    const host = hostRef.current;
    const header = headerRef.current;
    const controls = controlHostRef.current;

    if (host) {
      delete host.dataset.aim4priceSiteZoomHost;
      delete host.dataset.aim4priceSiteZoomMode;
      host.style.removeProperty('--aim4price-site-workspace-zoom');
    }

    if (header) {
      delete header.dataset.aim4priceAppHeader;
    }

    if (controls?.isConnected) {
      controls.remove();
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

    let nextControlHost = controlHostRef.current;
    if (!nextControlHost || nextControlHost.parentElement !== headerActions) {
      if (nextControlHost?.isConnected) nextControlHost.remove();
      nextControlHost = document.createElement('span');
      nextControlHost.className = styles.headerSlot;
      nextControlHost.dataset.aim4priceSiteZoomSlot = 'true';
      headerActions.appendChild(nextControlHost);
      controlHostRef.current = nextControlHost;
      setControlHost(nextControlHost);
    }

    header.dataset.aim4priceAppHeader = 'true';
    host.dataset.aim4priceSiteZoomHost = 'true';
    host.dataset.aim4priceSiteZoomMode = siteZoomMode(pathname);
    host.style.setProperty('--aim4price-site-workspace-zoom', String(zoomRef.current / 100));
    setIsAvailable(true);
    return true;
  }, [clearBoundHost, pathname]);

  useEffect(() => {
    const savedZoom = readSavedZoom();
    zoomRef.current = savedZoom;
    setZoom(savedZoom);
    setHasLoadedPreference(true);
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
    hostRef.current?.style.setProperty('--aim4price-site-workspace-zoom', String(zoom / 100));

    if (!hasLoadedPreference) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, String(zoom));
    } catch {
      // The control still works for the current session when storage is blocked.
    }
  }, [hasLoadedPreference, zoom]);

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

  const changeZoom = useCallback((nextZoom: number) => {
    const normalizedZoom = clampZoom(nextZoom);
    const host = hostRef.current;
    const usesContainedScroll = host?.dataset.aim4priceSiteZoomMode === 'workspace';
    const previousScrollWidth = usesContainedScroll ? host.scrollWidth : 0;
    const previousCenter = usesContainedScroll && previousScrollWidth > 0
      ? (host.scrollLeft + host.clientWidth / 2) / previousScrollWidth
      : 0;

    setShowIntro(false);
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

  const controls = isAvailable ? (
    <div
      className={`${styles.controls} ${showIntro ? styles.controlsIntro : ''}`}
      role="toolbar"
      aria-label="Aim4price page zoom controls"
      data-site-workspace-zoom-controls
    >
      <button
        type="button"
        className={styles.zoomButton}
        onClick={() => changeZoom(zoom - ZOOM_STEP)}
        disabled={zoom <= MIN_ZOOM}
        aria-label="Zoom page out"
        title="Decrease page size"
      >
        −
      </button>

      <button
        type="button"
        className={styles.zoomValue}
        onClick={() => changeZoom(DEFAULT_ZOOM)}
        aria-label={`Page zoom ${zoom} percent. Reset to 100 percent.`}
        title="Reset page size to 100%"
      >
        {zoom}%
      </button>

      <button
        type="button"
        className={styles.zoomButton}
        onClick={() => changeZoom(zoom + ZOOM_STEP)}
        disabled={zoom >= MAX_ZOOM}
        aria-label="Zoom page in"
        title="Increase page size"
      >
        +
      </button>

      {showIntro ? (
        <span className={styles.introNote} role="status">
          Increase or decrease page size here.
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
