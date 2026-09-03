'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import styles from './SiteWorkspaceZoom.module.css';

const STORAGE_KEY = 'aim4price.site.workspace-zoom.v1';
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 70;
const MAX_ZOOM = 150;
const ZOOM_STEP = 10;
const EXCLUDED_ROUTE_PREFIXES = ['/owner-app', '/dealer', '/field-manager', '/admin'] as const;

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

function readSavedZoom(): number {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_ZOOM;
    return clampZoom(Number(saved));
  } catch {
    return DEFAULT_ZOOM;
  }
}

export default function SiteWorkspaceZoom({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  const clearBoundHost = useCallback(() => {
    const host = hostRef.current;
    const header = headerRef.current;

    if (host) {
      delete host.dataset.aim4priceSiteZoomHost;
      host.style.removeProperty('--aim4price-site-workspace-zoom');
    }

    if (header) {
      delete header.dataset.aim4priceAppHeader;
    }

    hostRef.current = null;
    headerRef.current = null;
  }, []);

  const bindCurrentPage = useCallback((): boolean => {
    const root = rootRef.current;
    if (!root || isExcludedRoute(pathname)) return false;

    const brandLink = root.querySelector<HTMLAnchorElement>('a[aria-label="Go to Aim4price home"]');
    const header = brandLink?.closest<HTMLElement>('header') ?? null;
    const host = header?.parentElement ?? null;

    if (!header || !host || !root.contains(host)) return false;

    if (hostRef.current !== host || headerRef.current !== header) {
      clearBoundHost();
      hostRef.current = host;
      headerRef.current = header;
    }

    header.dataset.aim4priceAppHeader = 'true';
    host.dataset.aim4priceSiteZoomHost = 'true';
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

    let frameId = window.requestAnimationFrame(() => {
      bindCurrentPage();
    });

    const root = rootRef.current;
    if (!root) return () => window.cancelAnimationFrame(frameId);

    const observer = new MutationObserver(() => {
      if (hostRef.current?.isConnected && headerRef.current?.isConnected) return;
      bindCurrentPage();
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      clearBoundHost();
    };
  }, [bindCurrentPage, clearBoundHost, pathname]);

  const changeZoom = useCallback((nextZoom: number) => {
    const normalizedZoom = clampZoom(nextZoom);
    const host = hostRef.current;
    const previousScrollWidth = host?.scrollWidth ?? 0;
    const previousCenter = host && previousScrollWidth > 0
      ? (host.scrollLeft + host.clientWidth / 2) / previousScrollWidth
      : 0;

    zoomRef.current = normalizedZoom;
    host?.style.setProperty('--aim4price-site-workspace-zoom', String(normalizedZoom / 100));
    setZoom(normalizedZoom);

    if (!host || previousScrollWidth <= 0) return;

    window.requestAnimationFrame(() => {
      if (!host.isConnected) return;
      const nextScrollWidth = host.scrollWidth;
      const desiredLeft = previousCenter * nextScrollWidth - host.clientWidth / 2;
      host.scrollLeft = Math.max(0, desiredLeft);
    });
  }, []);

  return (
    <div ref={rootRef} className={styles.root} data-site-workspace-zoom-root>
      {children}

      {isAvailable ? (
        <div className={styles.controls} role="toolbar" aria-label="Aim4price page zoom controls">
          <button
            type="button"
            className={styles.zoomButton}
            onClick={() => changeZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom page out"
            title="Zoom out"
          >
            −
          </button>

          <button
            type="button"
            className={styles.zoomValue}
            onClick={() => changeZoom(DEFAULT_ZOOM)}
            aria-label={`Page zoom ${zoom} percent. Reset to 100 percent.`}
            title="Reset to 100%"
          >
            {zoom}%
          </button>

          <button
            type="button"
            className={styles.zoomButton}
            onClick={() => changeZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom page in"
            title="Zoom in"
          >
            +
          </button>
        </div>
      ) : null}
    </div>
  );
}
