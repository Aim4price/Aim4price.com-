'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
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

const SHOW_DELAY_MS = 160;
const HIDE_GRACE_MS = 260;
const MIN_VISIBLE_MS = 720;
const EXIT_TRANSITION_MS = 180;

const ROUTE_HANDOFF_MS = 950;
const ROUTE_QUIET_MS = 260;
const ROUTE_FAILSAFE_MS = 14000;
const NAVIGATION_FETCH_WINDOW_MS = 3600;
const BOOT_FETCH_WINDOW_MS = 2400;

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

function getInternalNavigationUrl(event: MouseEvent) {
  if (event.defaultPrevented) return null;
  if (event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

  const anchor = getClosestAnchor(event.target) as HTMLAnchorElement | null;
  if (!anchor || isExternalOrDownloadAnchor(anchor)) return null;

  const href = anchor.getAttribute('href')?.trim();
  if (!href) return null;

  try {
    const nextUrl = new URL(href, window.location.href);
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const nextPath = `${nextUrl.pathname}${nextUrl.search}`;

    if (nextPath === currentPath) return null;
    if (isGlobalLoadingDisabledPath(nextUrl.pathname)) return null;

    return nextUrl;
  } catch {
    return null;
  }
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

function getClientPathname() {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

export default function GlobalLoadingLayer() {
  const pathname = usePathname();
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const activeKeysRef = useRef<string[]>([]);
  const pathnameRef = useRef(pathname);
  const lastCommittedPathRef = useRef(pathname);
  const hasCommittedInitialPathRef = useRef(false);
  const pendingRouteTargetPathRef = useRef<string | null>(null);

  const showDelayRef = useRef<number | null>(null);
  const hideDelayRef = useRef<number | null>(null);
  const exitDelayRef = useRef<number | null>(null);
  const showFrameRef = useRef<number | null>(null);

  const renderStartedAtRef = useRef(0);
  const routeReleaseRef = useRef<number | null>(null);
  const routeFailsafeRef = useRef<number | null>(null);
  const routeHandoffUntilRef = useRef(0);
  const routeLastActivityAtRef = useRef(0);
  const bootFetchTrackingUntilRef = useRef(Date.now() + BOOT_FETCH_WINDOW_MS);
  const navigationFetchTrackingUntilRef = useRef(0);
  const fetchIdRef = useRef(0);

  function clearTimer(timerRef: MutableRefObject<number | null>) {
    if (!timerRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function clearAnimationFrame(frameRef: MutableRefObject<number | null>) {
    if (!frameRef.current) return;
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }

  function clearGlobalLoadingTimers() {
    clearTimer(showDelayRef);
    clearTimer(hideDelayRef);
    clearTimer(exitDelayRef);
    clearTimer(routeReleaseRef);
    clearTimer(routeFailsafeRef);
    clearAnimationFrame(showFrameRef);
  }

  function commitActiveKeys(nextKeys: string[]) {
    activeKeysRef.current = nextKeys;
    setActiveKeys(nextKeys);
  }

  function hasRouteLoadingKey(keys = activeKeysRef.current) {
    return keys.includes(ROUTE_LOADING_KEY);
  }

  function hasBlockingKeys(keys = activeKeysRef.current) {
    return keys.some((key) => key !== ROUTE_LOADING_KEY);
  }

  function markRouteActivity() {
    routeLastActivityAtRef.current = Date.now();
  }

  function markNavigationFetchWindow() {
    navigationFetchTrackingUntilRef.current = Date.now() + NAVIGATION_FETCH_WINDOW_MS;
  }

  function hasPendingEnabledRoute() {
    const pendingTargetPath = pendingRouteTargetPathRef.current;
    return Boolean(pendingTargetPath && !isGlobalLoadingDisabledPath(pendingTargetPath));
  }

  function stopAllGlobalLoading() {
    clearGlobalLoadingTimers();
    activeKeysRef.current = [];
    pendingRouteTargetPathRef.current = null;
    navigationFetchTrackingUntilRef.current = 0;
    bootFetchTrackingUntilRef.current = 0;
    routeHandoffUntilRef.current = 0;
    routeLastActivityAtRef.current = 0;
    setActiveKeys([]);
    setIsVisible(false);
    setShouldRender(false);
  }

  function removeLoadingKey(key: string) {
    const currentKeys = activeKeysRef.current;
    if (!currentKeys.includes(key)) return;

    markRouteActivity();
    const nextKeys = currentKeys.filter((currentKey) => currentKey !== key);
    commitActiveKeys(nextKeys);

    if (key !== ROUTE_LOADING_KEY && hasRouteLoadingKey(nextKeys)) {
      scheduleRouteRelease();
    }
  }

  function addLoadingKey(key: string) {
    const currentKeys = activeKeysRef.current;
    markRouteActivity();

    if (currentKeys.includes(key)) {
      if (key !== ROUTE_LOADING_KEY && hasRouteLoadingKey(currentKeys)) {
        scheduleRouteRelease();
      }
      return;
    }

    const nextKeys = [...currentKeys, key];
    commitActiveKeys(nextKeys);

    if (key !== ROUTE_LOADING_KEY && hasRouteLoadingKey(nextKeys)) {
      scheduleRouteRelease();
    }
  }

  function startNonRouteLoading(key: string) {
    if (isGlobalLoadingDisabledPath(getClientPathname())) return;
    addLoadingKey(key);
  }

  function startRouteLoading(targetPathname: string) {
    if (isGlobalLoadingDisabledPath(targetPathname)) {
      stopAllGlobalLoading();
      return;
    }

    const now = Date.now();
    pendingRouteTargetPathRef.current = targetPathname;
    markNavigationFetchWindow();
    routeHandoffUntilRef.current = Math.max(routeHandoffUntilRef.current, now + ROUTE_HANDOFF_MS);
    routeLastActivityAtRef.current = now;
    addLoadingKey(ROUTE_LOADING_KEY);
    scheduleRouteRelease();

    clearTimer(routeFailsafeRef);
    routeFailsafeRef.current = window.setTimeout(() => {
      removeLoadingKey(ROUTE_LOADING_KEY);
      routeFailsafeRef.current = null;
      routeHandoffUntilRef.current = 0;
    }, ROUTE_FAILSAFE_MS);
  }

  function scheduleRouteRelease() {
    if (!hasRouteLoadingKey()) return;

    clearTimer(routeReleaseRef);

    const now = Date.now();
    const handoffRemainingMs = Math.max(0, routeHandoffUntilRef.current - now);
    const quietRemainingMs = Math.max(0, ROUTE_QUIET_MS - (now - routeLastActivityAtRef.current));
    const blockingKeysDelayMs = hasBlockingKeys() ? ROUTE_QUIET_MS : 0;
    const nextCheckInMs = Math.max(20, handoffRemainingMs, quietRemainingMs, blockingKeysDelayMs);

    routeReleaseRef.current = window.setTimeout(() => {
      routeReleaseRef.current = null;

      if (!hasRouteLoadingKey()) return;

      if (isGlobalLoadingDisabledPath(getClientPathname())) {
        if (hasPendingEnabledRoute()) {
          scheduleRouteRelease();
          return;
        }

        stopAllGlobalLoading();
        return;
      }

      const currentTime = Date.now();
      const isInsideHandoffWindow = currentTime < routeHandoffUntilRef.current;
      const isInsideQuietWindow = currentTime - routeLastActivityAtRef.current < ROUTE_QUIET_MS;

      if (hasBlockingKeys() || isInsideHandoffWindow || isInsideQuietWindow) {
        scheduleRouteRelease();
        return;
      }

      removeLoadingKey(ROUTE_LOADING_KEY);
      routeHandoffUntilRef.current = 0;
      clearTimer(routeFailsafeRef);
    }, nextCheckInMs);
  }

  useEffect(() => {
    activeKeysRef.current = activeKeys;
  }, [activeKeys]);

  useEffect(() => {
    const previousPathname = pathnameRef.current;
    const didPathnameChange = hasCommittedInitialPathRef.current && previousPathname !== pathname;

    pathnameRef.current = pathname;
    lastCommittedPathRef.current = pathname;

    const isDisabledPath = isGlobalLoadingDisabledPath(pathname);

    if (isDisabledPath && !hasPendingEnabledRoute()) {
      hasCommittedInitialPathRef.current = true;
      stopAllGlobalLoading();
      return;
    }

    if (!isDisabledPath && didPathnameChange && !hasRouteLoadingKey()) {
      startRouteLoading(pathname);
    }

    if (!isDisabledPath) {
      pendingRouteTargetPathRef.current = null;
    }

    if (hasRouteLoadingKey()) {
      markNavigationFetchWindow();
      routeHandoffUntilRef.current = Math.max(routeHandoffUntilRef.current, Date.now() + ROUTE_HANDOFF_MS);
      scheduleRouteRelease();
    }

    hasCommittedInitialPathRef.current = true;
  }, [pathname]);

  useEffect(() => {
    const isDisabledPath = isGlobalLoadingDisabledPath(pathname);

    if (isDisabledPath && !hasPendingEnabledRoute()) {
      stopAllGlobalLoading();
      return;
    }

    if (activeKeys.length) {
      clearTimer(hideDelayRef);
      clearTimer(exitDelayRef);

      if (shouldRender) {
        setIsVisible(true);
        return;
      }

      if (!showDelayRef.current) {
        showDelayRef.current = window.setTimeout(() => {
          showDelayRef.current = null;
          renderStartedAtRef.current = Date.now();
          setShouldRender(true);
          showFrameRef.current = window.requestAnimationFrame(() => {
            showFrameRef.current = null;
            setIsVisible(true);
          });
        }, SHOW_DELAY_MS);
      }

      return;
    }

    clearTimer(showDelayRef);
    clearAnimationFrame(showFrameRef);

    if (!shouldRender || hideDelayRef.current || exitDelayRef.current) return;

    const elapsedVisibleMs = Date.now() - renderStartedAtRef.current;
    const hideInMs = Math.max(HIDE_GRACE_MS, MIN_VISIBLE_MS - elapsedVisibleMs);

    hideDelayRef.current = window.setTimeout(() => {
      hideDelayRef.current = null;
      setIsVisible(false);

      exitDelayRef.current = window.setTimeout(() => {
        exitDelayRef.current = null;
        setShouldRender(false);
      }, EXIT_TRANSITION_MS);
    }, hideInMs);
  }, [activeKeys.length, pathname, shouldRender]);

  useEffect(() => {
    return () => {
      clearGlobalLoadingTimers();
    };
  }, []);

  useEffect(() => {
    function shouldTrackFetch() {
      if (isGlobalLoadingDisabledPath(getClientPathname())) return false;

      const now = Date.now();
      return (
        now <= bootFetchTrackingUntilRef.current ||
        now <= navigationFetchTrackingUntilRef.current ||
        hasRouteLoadingKey()
      );
    }

    function handleLoadingStart(event: Event) {
      startNonRouteLoading(getEventKey(event));
    }

    function handleLoadingStop(event: Event) {
      removeLoadingKey(getEventKey(event));
    }

    function handleDocumentClick(event: MouseEvent) {
      const nextUrl = getInternalNavigationUrl(event);
      if (nextUrl) {
        startRouteLoading(nextUrl.pathname);
      }
    }

    function handleLocationCommitted() {
      const nextPathname = getClientPathname();

      if (isGlobalLoadingDisabledPath(nextPathname)) {
        stopAllGlobalLoading();
        lastCommittedPathRef.current = nextPathname;
        return;
      }

      if (lastCommittedPathRef.current !== nextPathname) {
        startRouteLoading(nextPathname);
        lastCommittedPathRef.current = nextPathname;
        return;
      }

      if (hasRouteLoadingKey()) {
        markNavigationFetchWindow();
        scheduleRouteRelease();
      }
    }

    const originalFetch = window.fetch.bind(window);
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!isTrackableApiFetch(input, init) || !shouldTrackFetch()) {
        return originalFetch(input, init);
      }

      const fetchKey = `${FETCH_LOADING_KEY_PREFIX}:${++fetchIdRef.current}`;
      startNonRouteLoading(fetchKey);

      try {
        return await originalFetch(input, init);
      } finally {
        removeLoadingKey(fetchKey);
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

  if (!shouldRender || isGlobalLoadingDisabledPath(pathname)) return null;

  return <GlobalLoadingScreen isVisible={isVisible} label="Loading all data..." />;
}
