'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import styles from './asset-register-workspace-frame.module.css';

const STORAGE_KEY = 'aim4price.asset-register.workspace-zoom.v1';
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 70;
const MAX_ZOOM = 150;
const ZOOM_STEP = 10;
const FIT_MIN_ZOOM = 70;
const WORKSPACE_BASE_WIDTH = 1180;

type WorkspaceStyle = CSSProperties & {
  '--asset-register-workspace-zoom': number;
};

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value)));
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

export default function AssetRegisterWorkspaceFrame({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);

  useEffect(() => {
    setZoom(readSavedZoom());
    setHasLoadedPreference(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedPreference) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, String(zoom));
    } catch {
      // Local storage can be unavailable in restricted browser contexts. The
      // control still works for the current page session in that case.
    }
  }, [hasLoadedPreference, zoom]);

  const changeZoom = useCallback((nextZoom: number) => {
    const viewport = viewportRef.current;
    const previousScrollWidth = viewport?.scrollWidth ?? 0;
    const previousCenter = viewport && previousScrollWidth > 0
      ? (viewport.scrollLeft + viewport.clientWidth / 2) / previousScrollWidth
      : 0;

    setZoom(clampZoom(nextZoom));

    if (!viewport || previousScrollWidth <= 0) return;

    window.requestAnimationFrame(() => {
      const nextScrollWidth = viewport.scrollWidth;
      const desiredLeft = previousCenter * nextScrollWidth - viewport.clientWidth / 2;
      viewport.scrollLeft = Math.max(0, desiredLeft);
    });
  }, []);

  const fitWidth = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const usableWidth = Math.max(1, viewport.clientWidth - 24);
    const rawZoom = (usableWidth / WORKSPACE_BASE_WIDTH) * 100;
    const fittedZoom = Math.max(FIT_MIN_ZOOM, Math.min(100, Math.floor(rawZoom / 5) * 5));

    setZoom(clampZoom(fittedZoom));
    window.requestAnimationFrame(() => {
      viewport.scrollLeft = 0;
    });
  }, []);

  const workspaceStyle: WorkspaceStyle = {
    '--asset-register-workspace-zoom': zoom / 100,
  };

  return (
    <div className={styles.frame} data-asset-register-workspace-frame>
      <div className={styles.toolbar} role="toolbar" aria-label="Asset Register view controls">
        <div className={styles.toolbarCopy}>
          <strong>Workspace view</strong>
          <span>Zoom the working area without changing its layout.</span>
        </div>

        <div className={styles.zoomControls}>
          <button
            type="button"
            className={styles.zoomButton}
            onClick={() => changeZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom Asset Register out"
            title="Zoom out"
          >
            −
          </button>

          <button
            type="button"
            className={styles.zoomValue}
            onClick={() => changeZoom(DEFAULT_ZOOM)}
            aria-label={`Asset Register zoom ${zoom} percent. Reset to 100 percent.`}
            title="Reset to 100%"
          >
            {zoom}%
          </button>

          <button
            type="button"
            className={styles.zoomButton}
            onClick={() => changeZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom Asset Register in"
            title="Zoom in"
          >
            +
          </button>

          <button
            type="button"
            className={styles.fitButton}
            onClick={fitWidth}
            title="Fit the stable workspace into the available width"
          >
            Fit width
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={styles.viewport}
        data-workspace-zoom={zoom}
        aria-label="Scrollable Asset Register workspace"
      >
        <div className={styles.canvas} style={workspaceStyle}>
          {children}
        </div>
      </div>
    </div>
  );
}
