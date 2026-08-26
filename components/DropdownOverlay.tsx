'use client';

import { createPortal } from 'react-dom';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type RefObject,
} from 'react';
import {
  applyDropdownOverlayGeometry,
  calculateDropdownOverlayPosition,
  type DropdownOverlayPosition,
} from '../lib/dropdown-overlay-position';

const VIEWPORT_GUTTER = 12;
const DEFAULT_GAP = 8;
const DEFAULT_MAX_HEIGHT = 360;

type DropdownOverlayProps = HTMLAttributes<HTMLDivElement> & {
  anchorRef?: RefObject<HTMLElement>;
  gap?: number;
  maxHeight?: number;
  matchAnchorWidth?: boolean;
  minimumWidth?: number;
};

function samePosition(current: DropdownOverlayPosition | null, next: DropdownOverlayPosition): boolean {
  return Boolean(
    current
      && Math.abs(current.left - next.left) < 0.5
      && Math.abs(current.top - next.top) < 0.5
      && Math.abs(current.width - next.width) < 0.5
      && Math.abs(current.maxHeight - next.maxHeight) < 0.5
      && current.placement === next.placement,
  );
}

function usableElement(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element === document.body || element === document.documentElement) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function resolveFallbackAnchor(listboxId?: string): HTMLElement | null {
  if (listboxId) {
    const controlledBy = document.querySelector(`[aria-controls="${CSS.escape(listboxId)}"]`);
    if (usableElement(controlledBy)) return controlledBy;
  }

  const activeElement = usableElement(document.activeElement) ? document.activeElement : null;
  const expandedSelector = [
    '[aria-haspopup="listbox"][aria-expanded="true"]',
    '[role="combobox"][aria-expanded="true"]',
  ].join(',');
  if (activeElement?.matches(expandedSelector)) return activeElement;

  const expandedTriggers = Array.from(
    document.querySelectorAll<HTMLElement>(expandedSelector),
  );
  for (let index = expandedTriggers.length - 1; index >= 0; index -= 1) {
    if (usableElement(expandedTriggers[index])) return expandedTriggers[index];
  }

  return activeElement;
}

export default function DropdownOverlay({
  anchorRef,
  gap = DEFAULT_GAP,
  maxHeight = DEFAULT_MAX_HEIGHT,
  matchAnchorWidth = true,
  minimumWidth = 0,
  style,
  onMouseDown,
  onPointerDown,
  onTouchStart,
  id,
  children,
  ...attributes
}: DropdownOverlayProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fallbackAnchorRef = useRef<HTMLElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [position, setPosition] = useState<DropdownOverlayPosition | null>(null);

  const attachMenuRef = useCallback((menu: HTMLDivElement | null) => {
    menuRef.current = menu;
    if (!menu) return;

    applyDropdownOverlayGeometry(menu.style, {
      position: null,
      fallbackMaxHeight: maxHeight,
      viewportGutter: VIEWPORT_GUTTER,
      visible: false,
    });
  }, [maxHeight]);

  const updatePosition = useCallback(() => {
    const menu = menuRef.current;
    const anchor = anchorRef?.current ?? fallbackAnchorRef.current;
    if (!menu || !anchor || !anchor.isConnected) return;

    const anchorRect = anchor.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportLeft = visualViewport?.offsetLeft ?? 0;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportWidth = visualViewport?.width ?? window.innerWidth;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const maximumWidth = Math.max(1, viewportWidth - (VIEWPORT_GUTTER * 2));
    const measurementWidth = Math.min(
      maximumWidth,
      Math.max(1, anchorRect.width, minimumWidth),
    );
    applyDropdownOverlayGeometry(menu.style, {
      position: {
        left: viewportLeft + VIEWPORT_GUTTER,
        top: viewportTop + VIEWPORT_GUTTER,
        width: measurementWidth,
        maxHeight,
      },
      fallbackMaxHeight: maxHeight,
      viewportGutter: VIEWPORT_GUTTER,
      visible: false,
    });
    const initialContentWidth = menu.scrollWidth;
    const provisionalWidth = Math.min(
      maximumWidth,
      Math.max(
        anchorRect.width,
        minimumWidth,
        matchAnchorWidth ? 0 : initialContentWidth,
      ),
    );
    applyDropdownOverlayGeometry(menu.style, {
      position: {
        left: viewportLeft + VIEWPORT_GUTTER,
        top: viewportTop + VIEWPORT_GUTTER,
        width: provisionalWidth,
        maxHeight,
      },
      fallbackMaxHeight: maxHeight,
      viewportGutter: VIEWPORT_GUTTER,
      visible: false,
    });
    const next = calculateDropdownOverlayPosition({
      anchor: anchorRect,
      viewport: {
        left: viewportLeft,
        top: viewportTop,
        width: viewportWidth,
        height: viewportHeight,
      },
      contentWidth: Math.max(initialContentWidth, menu.scrollWidth),
      contentHeight: menu.scrollHeight,
      gap,
      gutter: VIEWPORT_GUTTER,
      maxHeight,
      matchAnchorWidth,
      minimumWidth,
    });

    applyDropdownOverlayGeometry(menu.style, {
      position: next,
      fallbackMaxHeight: maxHeight,
      viewportGutter: VIEWPORT_GUTTER,
    });
    setPosition((current) => (samePosition(current, next) ? current : next));
  }, [anchorRef, gap, matchAnchorWidth, maxHeight, minimumWidth]);

  const schedulePositionUpdate = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => {
    fallbackAnchorRef.current = anchorRef?.current ?? resolveFallbackAnchor(id);
    updatePosition();

    const menu = menuRef.current;
    const anchor = anchorRef?.current ?? fallbackAnchorRef.current;
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(schedulePositionUpdate);
    if (menu) resizeObserver?.observe(menu);
    if (anchor) resizeObserver?.observe(anchor);

    window.addEventListener('resize', schedulePositionUpdate);
    window.addEventListener('scroll', schedulePositionUpdate, true);
    window.visualViewport?.addEventListener('resize', schedulePositionUpdate);
    window.visualViewport?.addEventListener('scroll', schedulePositionUpdate);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', schedulePositionUpdate);
      window.removeEventListener('scroll', schedulePositionUpdate, true);
      window.visualViewport?.removeEventListener('resize', schedulePositionUpdate);
      window.visualViewport?.removeEventListener('scroll', schedulePositionUpdate);
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [anchorRef, id, schedulePositionUpdate, updatePosition]);

  if (typeof document === 'undefined') return null;

  const overlayStyle = {
    ...style,
    '--dropdown-overlay-left': `${position?.left ?? 0}px`,
    '--dropdown-overlay-top': `${position?.top ?? 0}px`,
    '--dropdown-overlay-width': `${position?.width ?? 1}px`,
    '--dropdown-overlay-max-height': `${position?.maxHeight ?? maxHeight}px`,
    '--dropdown-overlay-visibility': position ? 'visible' : 'hidden',
  } as CSSProperties;

  return createPortal(
    <div
      {...attributes}
      id={id}
      ref={attachMenuRef}
      data-dropdown-overlay="true"
      style={overlayStyle}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        event.stopPropagation();
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        event.stopPropagation();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
