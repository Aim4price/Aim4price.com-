'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import {
  WEBSITE_DESIGN_WIDTH, WEBSITE_DESIGN_HEIGHT, WEBSITE_MIN_MANUAL_SCALE,
  WEBSITE_MAX_MANUAL_SCALE, WEBSITE_SCALE_STEP, WEBSITE_PREFERENCE_KEY,
  WEBSITE_OVERLAY_ROOT_ID, calculateWebsiteScale, stepWebsiteScale,
  isNativeWorkspace, parseWebsitePreference, type WebsitePreference,
} from '../lib/website-canvas';
import styles from './SiteWorkspaceZoom.module.css';
import { WebsiteCanvasContext } from './WebsitePortal';

function availableUnzoomedWidth(): number {
  // Browser zoom changes innerWidth, but must not cause Aim4price to cancel
  // the user's magnification. outerWidth remains stable across browser zoom.
  // The scrollbar belongs to viewport mechanics, not the desktop composition.
  const width = window.outerWidth > 0 ? window.outerWidth : window.innerWidth;
  return Math.max(1, width - Math.max(0, window.innerWidth - document.documentElement.getBoundingClientRect().width));
}

export default function SiteWorkspaceZoom({ children, footer, operational }: {
  children: ReactNode;
  footer: ReactNode;
  operational: ReactNode;
}) {
  const pathname = usePathname() || '/';
  const native = isNativeWorkspace(pathname);
  const canvasRef = useRef<HTMLDivElement>(null);
  const syncOverlayWidths = useCallback(() => {
    canvasRef.current?.querySelectorAll<HTMLElement>('[data-website-overlay]').forEach((overlay) => {
      const style = getComputedStyle(overlay);
      const padding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
      overlay.style.setProperty('--website-dialog-reference-width', `${WEBSITE_DESIGN_WIDTH - padding}px`);
    });
  }, []);
  const [preference, setPreference] = useState<WebsitePreference>({ mode: 'auto' });
  const [automaticScale, setAutomaticScale] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [controlHost, setControlHost] = useState<HTMLElement | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const scale = preference.mode === 'manual' ? preference.scale : automaticScale;

  useLayoutEffect(() => {
    if (native) return;
    try { setPreference(parseWebsitePreference(localStorage.getItem(WEBSITE_PREFERENCE_KEY))); }
    catch { setPreference({ mode: 'auto' }); }
    const syncAutomaticScale = () => setAutomaticScale(calculateWebsiteScale(availableUnzoomedWidth()));
    syncAutomaticScale();
    setLoaded(true);
    window.addEventListener('resize', syncAutomaticScale);
    return () => window.removeEventListener('resize', syncAutomaticScale);
  }, [native]);

  useEffect(() => {
    if (native || !loaded) return;
    try { localStorage.setItem(WEBSITE_PREFERENCE_KEY, JSON.stringify(preference)); }
    catch { /* Controls remain available when persistent storage is blocked. */ }
  }, [loaded, native, preference]);

  useLayoutEffect(() => {
    if (native) return;
    const syncCanvasOrigin = () => {
      const canvas = canvasRef.current;
      if (canvas) canvas.style.setProperty('--website-canvas-left', `${canvas.getBoundingClientRect().left / scale}px`);
    };
    const syncViewport = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      canvasRef.current?.style.setProperty('--website-visible-height', `${height / scale}px`);
      canvasRef.current?.style.setProperty('--website-visible-width', `${document.documentElement.clientWidth / scale}px`);
      syncCanvasOrigin();
      syncOverlayWidths();
      window.dispatchEvent(new Event('aim4price:canvas-geometry'));
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('scroll', syncCanvasOrigin, { passive: true });
    window.visualViewport?.addEventListener('resize', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('scroll', syncCanvasOrigin);
      window.visualViewport?.removeEventListener('resize', syncViewport);
    };
  }, [native, scale, syncOverlayWidths]);

  useLayoutEffect(() => {
    setControlHost(null);
    const canvas = canvasRef.current;
    if (native || !canvas) return;
    const bindControls = () => {
      syncOverlayWidths();
      const header = canvas.querySelector('a[aria-label="Go to Aim4price home"]')?.closest('header');
      const zoomHost = header?.querySelector('[data-website-zoom-host]');
      setControlHost(zoomHost instanceof HTMLElement ? zoomHost : null);
    };
    bindControls();
    const observer = new MutationObserver(bindControls);
    observer.observe(canvas, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [native, pathname, syncOverlayWidths]);

  const changeScale = useCallback((delta: number) => {
    setShowIntro(false);
    setPreference((current) => ({
      mode: 'manual',
      scale: stepWebsiteScale(current.mode === 'manual' ? current.scale : automaticScale, delta),
    }));
  }, [automaticScale]);

  useEffect(() => {
    setShowIntro(false);
    if (native || pathname !== '/' || !controlHost || !loaded) return;
    const key = `${WEBSITE_PREFERENCE_KEY}.intro`;
    try { if (localStorage.getItem(key) === 'seen') return; } catch { /* Storage is optional. */ }
    let hideTimer: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      setShowIntro(true);
      try { localStorage.setItem(key, 'seen'); } catch { /* The hint may repeat next visit. */ }
      hideTimer = setTimeout(() => setShowIntro(false), 5200);
    }, 900);
    return () => { clearTimeout(timer); clearTimeout(hideTimer); };
  }, [native, pathname, controlHost, loaded]);

  if (native) {
    // Preserve the original root structure and footer/tracker ordering for
    // operational and device-native routes. No website variables reach them.
    return <><div className={styles.root}>{children}</div>{operational}{footer}</>;
  }

  const canvasStyle = {
    width: WEBSITE_DESIGN_WIDTH,
    zoom: scale,
    '--website-design-width': `${WEBSITE_DESIGN_WIDTH}px`,
    '--website-dialog-reference-width': `${WEBSITE_DESIGN_WIDTH}px`,
    '--website-design-height': `${WEBSITE_DESIGN_HEIGHT}px`,
    '--website-design-vw': `${WEBSITE_DESIGN_WIDTH / 100}px`,
    '--website-design-vh': `${WEBSITE_DESIGN_HEIGHT / 100}px`,
    '--website-visible-height': `${WEBSITE_DESIGN_HEIGHT}px`,
  } as CSSProperties;
  const percentage = Math.round(scale * 100);
  const controls = (
    <div className={`${styles.controls} ${showIntro ? styles.controlsIntro : ''}`} role="toolbar" aria-label="Aim4price page size controls"
      data-site-workspace-zoom-controls data-zoom-preference={preference.mode}>
      <button type="button" className={styles.zoomButton} onClick={() => changeScale(-WEBSITE_SCALE_STEP)}
        disabled={scale <= WEBSITE_MIN_MANUAL_SCALE} aria-label="Zoom out" data-tooltip="Zoom out">−</button>
      <button type="button" className={styles.zoomValue} onClick={() => { setShowIntro(false); setPreference({ mode: 'auto' }); }}
        aria-label={`${preference.mode === 'auto' ? 'Automatic page size' : 'Page size'} ${percentage} percent. Return to automatic sizing.`}
        title={preference.mode === 'auto' ? 'Page size is automatic' : 'Return to automatic page size'}>{percentage}%</button>
      <button type="button" className={styles.zoomButton} onClick={() => changeScale(WEBSITE_SCALE_STEP)}
        disabled={scale >= WEBSITE_MAX_MANUAL_SCALE} aria-label="Zoom in" data-tooltip="Zoom in">+</button>
      {showIntro ? <span className={styles.introNote} role="status">Page size adjusts automatically. Use − or + if needed.</span> : null}
    </div>
  );

  return <WebsiteCanvasContext.Provider value={true}>
    <div className={styles.viewport} data-website-viewport>
      <div ref={canvasRef} className={styles.canvas} style={canvasStyle}
        data-website-canvas data-website-scale={scale}>
        {children}
        {operational}
        {footer}
        <div id={WEBSITE_OVERLAY_ROOT_ID} />
        {controlHost ? createPortal(controls, controlHost) : null}
      </div>
    </div>
  </WebsiteCanvasContext.Provider>;
}

