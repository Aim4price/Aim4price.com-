"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "../../components/WebsitePortal";
import styles from "./page.module.css";

type Props = {
  title: string;
  meta: string;
  titleId: string;
  compact: boolean;
  suspended: boolean;
  actions: ReactNode;
  children: ReactNode;
  onClose: () => void;
};

function DialogContent({ title, meta, titleId, compact, suspended, actions, children, onClose }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const suspendedRef = useRef(suspended);
  closeRef.current = onClose;
  suspendedRef.current = suspended;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });

    const controls = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    ) ?? []).filter((element) => element.getClientRects().length > 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (suspendedRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) { event.preventDefault(); panelRef.current?.focus(); return; }
        const current = document.activeElement;
        if (event.shiftKey && (current === first || current === panelRef.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (current === last || current === panelRef.current)) {
          event.preventDefault(); first.focus();
        }
      }
    };
    const handleFocus = (event: FocusEvent) => {
      if (suspendedRef.current) return;
      const target = event.target as HTMLElement;
      if (panelRef.current?.contains(target)) lastFocusRef.current = target;
      else (lastFocusRef.current ?? panelRef.current)?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocus);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocus);
      root.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    // Photo/contact dialogs own keyboard focus while they are above this panel.
    if (!suspended) (lastFocusRef.current ?? panelRef.current)?.focus({ preventScroll: true });
  }, [suspended]);

  return (
    <div
      className={`${styles.discoveryFocusOverlay} ${compact ? styles.compactAppSurface : ""}`}
      data-website-overlay
      onMouseDown={(event) => {
        if (!suspended && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className={styles.discoveryFocusPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.discoveryFocusHeader}>
          <div>
            <h2 id={titleId}>{title}</h2>
            <p>{meta}</p>
          </div>
          <button type="button" className={styles.discoveryFocusClose} onClick={onClose} aria-label="Close asset details">
            <span aria-hidden="true">×</span> Close
          </button>
        </header>
        <div className={styles.discoveryFocusActions}>{actions}</div>
        <div className={styles.discoveryFocusBody}>{children}</div>
      </section>
    </div>
  );
}

export default function DiscoveryAssetDialog(props: Props) {
  if (typeof document === "undefined") return null;
  return createPortal(<DialogContent {...props} />, document.body);
}
