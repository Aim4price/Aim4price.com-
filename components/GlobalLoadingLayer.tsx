'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  GLOBAL_LOADING_START_EVENT,
  GLOBAL_LOADING_STOP_EVENT,
  isGlobalLoadingDisabledPath,
  type GlobalLoadingEventDetail,
} from '../lib/global-loading';
import GlobalLoadingScreen from './GlobalLoadingScreen';

const ROUTE_LOADING_KEY = 'route-change';
const FETCH_LOADING_KEY_PREFIX = 'fetch';
const SHOW_DELAY_MS = 110;
const HIDE_GRACE_MS = 220;
const MIN_VISIBLE_MS = 620;
const ROUTE_SETTLE_MS = 520;
const ROUTE_FAILSAFE_MS = 12000;
const NAVIGATION_FETCH_WINDOW_MS = 2400;
const BOOT_FETCH_WINDOW_MS = 2600;

function getEventKey(event: Event) {
  const detail = (event as CustomEvent<GlobalLoadingEventDetail>).detail;
  return detail?.key?.trim() || 'global';
}

function getClosestAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest('a[href]');
}

function isExternalOrDownloadAnchor(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute('href')?.trim();
  if (!href) return true;
  if (href.startsWith('#')) return true;
  if (/^(mailto|tel|sms):/i.test(href)) return true;
  if (anchor.hasAttribute('download')) return true;

  const target = anchor.getAttribute('target');
  if (target && target.toLowerCase() !== '_self') return true;

  try {
    const nextUrl = new URL(href, window.location.href);
    return nextUrl.origin !== window.location.origin;
  } catch {
    return true;
  }
}

function shouldShowRouteLoader(event: MouseEvent) {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (isGlobalLoadingDisabledPath(window.location.pathname)) return false;

  const anchor = getClosestAnchor(event.target) as HTMLAnchorElement | null;
  if (!anchor || isExternalOrDownloadAnchor(anchor)) return false;

  const href = anchor.getAttribute('href')?.trim();
  if (!href) return false;

  let nextUrl: URL;

  try {
    nextUrl = new URL(href, window.location.href);
  } catch {
    return false;
  }

  if (isGlobalLoadingDisabledPath(nextUrl.pathname)) return false;

  const currentPath = `${window.location.pathname}${window.location.search}`;
  const nextPath = `${nextUrl.pathname}${nextUrl.search}`;

  return nextPath !== currentPath;
}

function getFetchUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function getFetchMethod(input: RequestInfo | URL, init?: RequestInit) {
  const initMethod = init?.method?.trim();
  if (initMethod) return initMethod.toUpperCase();
  if (typeof input === 'object' && 'method' in input && typeof input.method === 'string') {
    return input.method.toUpperCase();
  }
  return 'GET';
}

function isTrackableApiFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (getFetchMethod(input, init) !== 'GET') return false;

  try {
    const url = new URL(getFetchUrl(input), window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (!url.pathname.startsWith('/api/')) return false;
    if (url.pathname.includes('/export') || url.searchParams.get('download') === '1') return false;
    return true;
  } catch {
    return false;
  }
}

export default function GlobalLoadingLayer() {
  const pathname = usePathname();
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [shouldRender, setShouldRender] = useState(false);

  const activeKeysRef = useRef<string[]>([]);
  const pathnameRef = useRef(pathname);
  const showDelayRef = useRef<number | null>(null);
  const hideDelayRef = useRef<number | null>(null);
  const renderStartedAtRef = useRef(0);
  const routeSettledRef = useRef<number | null>(null);
  const routeFailsafeRef = useRef<number | null>(null);
  const bootFetchTrackingUntilRef = useRef(Date.now() + BOOT_FETCH_WINDOW_MS);
  const navigationFetchTrackingUntilRef = useRef(0);
  const fetchIdRef = useRef(0);

  function clearGlobalLoadingTimers() {
    if (showDelayRef.current) {
      window.clearTimeout(showDelayRef.current);
      showDelayRef.current = null;
    }

    if (hideDelayRef.current) {
      window.clearTimeout(hideDelayRef.current);
      hideDelayRef.current = null;
    }

    if (routeSettledRef.current) {
      window.clearTimeout(routeSettledRef.current);
      routeSettledRef.current = null;
    }

    if (routeFailsafeRef.current) {
      window.clearTimeout(routeFailsafeRef.current);
      routeFailsafeRef.current = null;
    }
  }

  function stopAllGlobalLoading() {
    clearGlobalLoadingTimers();
    activeKeysRef.current = [];
    navigationFetchTrackingUntilRef.current = 0;
    bootFetchTrackingUntilRef.current = 0;
    setActiveKeys([]);
    setShouldRender(false);
  }

  useEffect(() => {
    activeKeysRef.current = activeKeys;
  }, [activeKeys]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (isGlobalLoadingDisabledPath(pathname)) {
      stopAllGlobalLoading();
      return;
    }

    if (activeKeys.length) {
      if (hideDelayRef.current) {
        window.clearTimeout(hideDelayRef.current);
        hideDelayRef.current = null;
      }

      if (!shouldRender && !showDelayRef.current) {
        showDelayRef.current = window.setTimeout(() => {
          showDelayRef.current = null;
          renderStartedAtRef.current = Date.now();
          setShouldRender(true);
        }, SHOW_DELAY_MS);
      }

      return;
    }

    if (showDelayRef.current) {
      window.clearTimeout(showDelayRef.current);
      showDelayRef.current = null;
    }

    if (!shouldRender || hideDelayRef.current) return;

    const elapsedVisibleMs = Date.now() - renderStartedAtRef.current;
    const hideInMs = Math.max(HIDE_GRACE_MS, MIN_VISIBLE_MS - elapsedVisibleMs);

    hideDelayRef.current = window.setTimeout(() => {
      hideDelayRef.current = null;
      setShouldRender(false);
    }, hideInMs);
  }, [activeKeys.length, pathname, shouldRender]);

  useEffect(() => {
    return () => {
      clearGlobalLoadingTimers();
    };
  }, []);

  useEffect(() => {
    function isCurrentPathDisabled() {
      if (isGlobalLoadingDisabledPath(window.location.pathname)) return true;
      return isGlobalLoadingDisabledPath(pathnameRef.current);
    }

    function startLoading(key: string) {
      if (isCurrentPathDisabled()) return;
      setActiveKeys((current) => (current.includes(key) ? current : [...current, key]));
    }

    function stopLoading(key: string) {
      setActiveKeys((current) => current.filter((currentKey) => currentKey !== key));
    }

    function markNavigationFetchWindow() {
      navigationFetchTrackingUntilRef.current = Date.now() + NAVIGATION_FETCH_WINDOW_MS;
    }

    function scheduleRouteSettled() {
      if (isCurrentPathDisabled()) {
        stopAllGlobalLoading();
        return;
      }

      markNavigationFetchWindow();

      if (routeSettledRef.current) {
        window.clearTimeout(routeSettledRef.current);
      }

      routeSettledRef.current = window.setTimeout(() => {
        stopLoading(ROUTE_LOADING_KEY);
        routeSettledRef.current = null;
      }, ROUTE_SETTLE_MS);

      if (routeFailsafeRef.current) {
        window.clearTimeout(routeFailsafeRef.current);
        routeFailsafeRef.current = null;
      }
    }

    function startRouteLoading() {
      if (isCurrentPathDisabled()) return;

      markNavigationFetchWindow();
      startLoading(ROUTE_LOADING_KEY);

      if (routeFailsafeRef.current) {
        window.clearTimeout(routeFailsafeRef.current);
      }

      routeFailsafeRef.current = window.setTimeout(() => {
        stopLoading(ROUTE_LOADING_KEY);
        routeFailsafeRef.current = null;
      }, ROUTE_FAILSAFE_MS);
    }

    function handleLoadingStart(event: Event) {
      startLoading(getEventKey(event));
    }

    function handleLoadingStop(event: Event) {
      stopLoading(getEventKey(event));
    }

    function handleDocumentClick(event: MouseEvent) {
      if (shouldShowRouteLoader(event)) {
        startRouteLoading();
      }
    }

    function shouldTrackFetch() {
      if (isCurrentPathDisabled()) return false;

      const now = Date.now();
      return (
        now <= bootFetchTrackingUntilRef.current ||
        now <= navigationFetchTrackingUntilRef.current ||
        activeKeysRef.current.includes(ROUTE_LOADING_KEY)
      );
    }

    function handleLocationCommitted() {
      if (isCurrentPathDisabled()) {
        stopAllGlobalLoading();
        return;
      }

      scheduleRouteSettled();
    }

    const originalFetch = window.fetch.bind(window);
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!isTrackableApiFetch(input, init) || !shouldTrackFetch()) {
        return originalFetch(input, init);
      }

      const fetchKey = `${FETCH_LOADING_KEY_PREFIX}:${++fetchIdRef.current}`;
      startLoading(fetchKey);

      try {
        return await originalFetch(input, init);
      } finally {
        stopLoading(fetchKey);
      }
    };

    window.history.pushState = function patchedPushState(...args) {
      const result = originalPushState(...args);
      window.setTimeout(handleLocationCommitted, 0);
      return result;
    };

    window.history.replaceState = function patchedReplaceState(...args) {
      const result = originalReplaceState(...args);
      window.setTimeout(handleLocationCommitted, 0);
      return result;
    };

    window.addEventListener(GLOBAL_LOADING_START_EVENT, handleLoadingStart as EventListener);
    window.addEventListener(GLOBAL_LOADING_STOP_EVENT, handleLoadingStop as EventListener);
    window.addEventListener('popstate', handleLocationCommitted);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.fetch = originalFetch;
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener(GLOBAL_LOADING_START_EVENT, handleLoadingStart as EventListener);
      window.removeEventListener(GLOBAL_LOADING_STOP_EVENT, handleLoadingStop as EventListener);
      window.removeEventListener('popstate', handleLocationCommitted);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, []);

  useEffect(() => {
    if (isGlobalLoadingDisabledPath(pathname)) {
      stopAllGlobalLoading();
      return;
    }

    navigationFetchTrackingUntilRef.current = Date.now() + NAVIGATION_FETCH_WINDOW_MS;

    if (routeSettledRef.current) {
      window.clearTimeout(routeSettledRef.current);
    }

    routeSettledRef.current = window.setTimeout(() => {
      setActiveKeys((current) => current.filter((key) => key !== ROUTE_LOADING_KEY));
      routeSettledRef.current = null;
    }, ROUTE_SETTLE_MS);

    if (routeFailsafeRef.current) {
      window.clearTimeout(routeFailsafeRef.current);
      routeFailsafeRef.current = null;
    }
  }, [pathname]);

  if (!shouldRender || isGlobalLoadingDisabledPath(pathname)) return null;

  return <GlobalLoadingScreen label="Loading data..." />;
}
