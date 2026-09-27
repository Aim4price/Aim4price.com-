"use client";

import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { currentWebsiteScale } from "../../lib/website-canvas";
import styles from "./page.module.css";

type AccountModalScrollerProps = {
  children?: ReactNode;
  label?: string;
};

type AccountModalScrollbarState = {
  isScrollable: boolean;
  thumbHeight: number;
  thumbTop: number;
};

export default function AccountModalScroller({ children, label }: AccountModalScrollerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startY: number;
    startScrollTop: number;
    maxScrollTop: number;
    maxThumbTop: number;
  } | null>(null);
  const [scrollbarState, setScrollbarState] =
    useState<AccountModalScrollbarState>({
      isScrollable: false,
      thumbHeight: 0,
      thumbTop: 0,
    });

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    let animationFrameId = 0;

    const updateScrollbar = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = window.requestAnimationFrame(() => {
        const scrollHeight = viewport.scrollHeight;
        const clientHeight = viewport.clientHeight;
        const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
        const isScrollable = maxScrollTop > 2;

        if (!isScrollable) {
          setScrollbarState((current) => {
            if (
              !current.isScrollable &&
              current.thumbHeight === 0 &&
              current.thumbTop === 0
            ) {
              return current;
            }

            return {
              isScrollable: false,
              thumbHeight: 0,
              thumbTop: 0,
            };
          });
          return;
        }

        const trackHeight = Math.max(
          1,
          railRef.current?.clientHeight || clientHeight,
        );
        const minThumbHeight = Math.min(72, Math.max(46, trackHeight * 0.18));
        const thumbHeight = Math.min(
          trackHeight,
          Math.max(minThumbHeight, (clientHeight / scrollHeight) * trackHeight),
        );
        const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
        const thumbTop =
          maxScrollTop > 0
            ? (viewport.scrollTop / maxScrollTop) * maxThumbTop
            : 0;
        const nextState = {
          isScrollable: true,
          thumbHeight: Math.round(thumbHeight),
          thumbTop: Math.round(thumbTop),
        };

        setScrollbarState((current) => {
          if (
            current.isScrollable === nextState.isScrollable &&
            current.thumbHeight === nextState.thumbHeight &&
            current.thumbTop === nextState.thumbTop
          ) {
            return current;
          }

          return nextState;
        });
      });
    };

    updateScrollbar();
    viewport.addEventListener("scroll", updateScrollbar, { passive: true });
    window.addEventListener("resize", updateScrollbar);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateScrollbar);

    if (resizeObserver) {
      resizeObserver.observe(viewport);

      if (contentRef.current) {
        resizeObserver.observe(contentRef.current);
      }

      if (railRef.current) {
        resizeObserver.observe(railRef.current);
      }
    }

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      viewport.removeEventListener("scroll", updateScrollbar);
      window.removeEventListener("resize", updateScrollbar);
      resizeObserver?.disconnect();
    };
  }, []);

  function handleScrollRailPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (event.target !== event.currentTarget || !scrollbarState.isScrollable) {
      return;
    }

    const viewport = viewportRef.current;
    const rail = railRef.current;

    if (!viewport || !rail) {
      return;
    }

    event.preventDefault();

    const railRect = rail.getBoundingClientRect();
    const pointerTop = (event.clientY - railRect.top) / currentWebsiteScale();
    const maxScrollTop = Math.max(
      0,
      viewport.scrollHeight - viewport.clientHeight,
    );
    const maxThumbTop = Math.max(
      1,
      rail.clientHeight - scrollbarState.thumbHeight,
    );
    const nextThumbTop = Math.min(
      maxThumbTop,
      Math.max(0, pointerTop - scrollbarState.thumbHeight / 2),
    );

    viewport.scrollTo({
      top: (nextThumbTop / maxThumbTop) * maxScrollTop,
      behavior: "smooth",
    });
  }

  function handleScrollThumbPointerDown(
    event: ReactPointerEvent<HTMLSpanElement>,
  ) {
    const viewport = viewportRef.current;
    const rail = railRef.current;

    if (!viewport || !rail || !scrollbarState.isScrollable) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: viewport.scrollTop,
      maxScrollTop: Math.max(0, viewport.scrollHeight - viewport.clientHeight),
      maxThumbTop: Math.max(1, rail.clientHeight - scrollbarState.thumbHeight),
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleScrollThumbPointerMove(
    event: ReactPointerEvent<HTMLSpanElement>,
  ) {
    const dragState = dragStateRef.current;
    const viewport = viewportRef.current;

    if (!dragState || !viewport || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const deltaY = (event.clientY - dragState.startY) / currentWebsiteScale();
    const nextScrollTop =
      dragState.startScrollTop +
      (deltaY / dragState.maxThumbTop) * dragState.maxScrollTop;

    viewport.scrollTop = Math.min(
      dragState.maxScrollTop,
      Math.max(0, nextScrollTop),
    );
  }

  function handleScrollThumbPointerEnd(
    event: ReactPointerEvent<HTMLSpanElement>,
  ) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
  }

  return (
    <div className={styles.accountModalScrollShell}>
      <div ref={viewportRef} className={styles.accountModalScrollViewport} tabIndex={label ? 0 : undefined} role={label ? "region" : undefined} aria-label={label}>
        <div ref={contentRef} className={styles.accountModalScrollContent}>
          {children}
        </div>
      </div>

      <div
        ref={railRef}
        className={`${styles.accountModalScrollRail} ${scrollbarState.isScrollable ? styles.accountModalScrollRailVisible : ""}`}
        aria-hidden="true"
        onPointerDown={handleScrollRailPointerDown}
      >
        <span
          className={styles.accountModalScrollThumb}
          style={
            scrollbarState.isScrollable
              ? {
                  height: `${scrollbarState.thumbHeight}px`,
                  transform: `translate3d(0, ${scrollbarState.thumbTop}px, 0)`,
                }
              : undefined
          }
          onPointerDown={handleScrollThumbPointerDown}
          onPointerMove={handleScrollThumbPointerMove}
          onPointerUp={handleScrollThumbPointerEnd}
          onPointerCancel={handleScrollThumbPointerEnd}
        />
      </div>
    </div>
  );
}

