'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  GLOBAL_LOADING_START_EVENT,
  GLOBAL_LOADING_STOP_EVENT,
  type GlobalLoadingEventDetail,
} from '../lib/global-loading';
import GlobalLoadingScreen from './GlobalLoadingScreen';

const ROUTE_LOADING_KEY = 'route-change';
const SHOW_DELAY_MS = 140;
const ROUTE_FAILSAFE_MS = 8500;

function getEventKey(event: Event) {
  const detail = (event as CustomEvent<GlobalLoadingEventDetail>).detail;
  return detail?.key?.trim() || 'global';
}

function getClosestAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest('a[href]');
}

function shouldShowRouteLoader(event: MouseEvent) {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const anchor = getClosestAnchor(event.target);
  if (!anchor) return false;

  const href = anchor.getAttribute('href')?.trim();
  if (!href) return false;
  if (href.startsWith('#')) return false;
  if (/^(mailto|tel|sms):/i.test(href)) return false;
  if (anchor.hasAttribute('download')) return false;

  const target = anchor.getAttribute('target');
  if (target && target.toLowerCase() !== '_self') return false;

  let nextUrl: URL;

  try {
    nextUrl = new URL(href, window.location.href);
  } catch {
    return false;
  }

  if (nextUrl.origin !== window.location.origin) return false;

  const currentPath = `${window.location.pathname}${window.location.search}`;
  const nextPath = `${nextUrl.pathname}${nextUrl.search}`;

  return nextPath !== currentPath;
}

export default function GlobalLoadingLayer() {
  const pathname = usePathname();
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [shouldRender, setShouldRender] = useState(false);
  const showDelayRef = useRef<number | null>(null);
  const routeFailsafeRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeKeys.length) {
      if (showDelayRef.current) {
        window.clearTimeout(showDelayRef.current);
      }

      showDelayRef.current = window.setTimeout(() => {
        setShouldRender(true);
      }, SHOW_DELAY_MS);

      return;
    }

    if (showDelayRef.current) {
      window.clearTimeout(showDelayRef.current);
      showDelayRef.current = null;
    }

    setShouldRender(false);
  }, [activeKeys.length]);

  useEffect(() => {
    return () => {
      if (showDelayRef.current) {
        window.clearTimeout(showDelayRef.current);
      }

      if (routeFailsafeRef.current) {
        window.clearTimeout(routeFailsafeRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setActiveKeys((current) => current.filter((key) => key !== ROUTE_LOADING_KEY));

    if (routeFailsafeRef.current) {
      window.clearTimeout(routeFailsafeRef.current);
      routeFailsafeRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    function startLoading(key: string) {
      setActiveKeys((current) => (current.includes(key) ? current : [...current, key]));
    }

    function stopLoading(key: string) {
      setActiveKeys((current) => current.filter((currentKey) => currentKey !== key));
    }

    function handleLoadingStart(event: Event) {
      startLoading(getEventKey(event));
    }

    function handleLoadingStop(event: Event) {
      stopLoading(getEventKey(event));
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!shouldShowRouteLoader(event)) return;

      startLoading(ROUTE_LOADING_KEY);

      if (routeFailsafeRef.current) {
        window.clearTimeout(routeFailsafeRef.current);
      }

      routeFailsafeRef.current = window.setTimeout(() => {
        stopLoading(ROUTE_LOADING_KEY);
        routeFailsafeRef.current = null;
      }, ROUTE_FAILSAFE_MS);
    }

    window.addEventListener(GLOBAL_LOADING_START_EVENT, handleLoadingStart as EventListener);
    window.addEventListener(GLOBAL_LOADING_STOP_EVENT, handleLoadingStop as EventListener);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener(GLOBAL_LOADING_START_EVENT, handleLoadingStart as EventListener);
      window.removeEventListener(GLOBAL_LOADING_STOP_EVENT, handleLoadingStop as EventListener);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, []);

  if (!shouldRender) return null;

  return <GlobalLoadingScreen />;
}
