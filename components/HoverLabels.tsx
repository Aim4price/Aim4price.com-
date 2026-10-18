'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import styles from './HoverLabels.module.css';

const controls = 'button, a, input, select, textarea, label, summary, [role="button"], [contenteditable]';

/** Resolve both explicit icon labels and the non-interactive hint on a clickable card. */
export function hoverLabelTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const explicit = target.closest<HTMLElement>('[data-tooltip]');
  if (explicit) return explicit.matches(':disabled') ? null : explicit;
  if (target.closest(controls)) return null;
  for (let node: Element | null = target; node && node !== document.body; node = node.parentElement) {
    const hint = node.querySelector<HTMLElement>(':scope > span[aria-hidden="true"][data-tooltip]');
    if (hint) return hint;
  }
  return null;
}

/** Mounted outside the transformed website canvas so cards cannot clip its labels. */
export default function HoverLabels() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, ready: false });
  const labelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const text = target?.dataset.tooltip ?? '';

  useEffect(() => {
    document.documentElement.dataset.hoverLabels = 'true';
    const hide = () => setTarget(null);
    const over = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.buttons) return;
      setTarget(hoverLabelTarget(event.target));
    };
    const out = (event: PointerEvent) => setTarget(hoverLabelTarget(event.relatedTarget));
    const focus = (event: FocusEvent) => {
      const node = event.target;
      if (node instanceof HTMLElement && node.matches(':focus-visible')) setTarget(hoverLabelTarget(node));
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hide(); };
    document.addEventListener('pointerover', over, true);
    document.addEventListener('pointerout', out, true);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('focusin', focus, true);
    document.addEventListener('focusout', hide, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('aim4price:canvas-geometry', hide);
    window.visualViewport?.addEventListener('resize', hide);
    window.visualViewport?.addEventListener('scroll', hide);
    window.addEventListener('blur', hide);
    return () => {
      delete document.documentElement.dataset.hoverLabels;
      document.removeEventListener('pointerover', over, true);
      document.removeEventListener('pointerout', out, true);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('focusin', focus, true);
      document.removeEventListener('focusout', hide, true);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('aim4price:canvas-geometry', hide);
      window.visualViewport?.removeEventListener('resize', hide);
      window.visualViewport?.removeEventListener('scroll', hide);
      window.removeEventListener('blur', hide);
    };
  }, []);

  useLayoutEffect(() => {
    if (!target || !text || !labelRef.current) return;
    // Hidden hints belong to their clickable card; highlight the control, never the tooltip.
    const control = target.closest<HTMLElement>('[data-message-banner]') ?? (target.getAttribute('aria-hidden') === 'true' ? target.parentElement : target);
    const highlight = control && !control.matches(':disabled, [aria-disabled="true"]') ? control : null;
    highlight?.classList.add(styles.activeControl);
    const anchor = (control ?? target).getBoundingClientRect();
    const box = labelRef.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + 12;
    const topEdge = (viewport?.offsetTop ?? 0) + 12;
    const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 24;
    const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 24;
    const left = Math.max(leftEdge, Math.min(anchor.left + anchor.width / 2 - box.width / 2, rightEdge - box.width));
    const above = anchor.top - box.height - 10;
    const top = Math.max(topEdge, Math.min(above >= topEdge ? above : anchor.bottom + 10, bottomEdge - box.height));
    setPosition({ left, top, ready: true });
    const previous = target.getAttribute('aria-describedby');
    if (target.getAttribute('aria-hidden') !== 'true') target.setAttribute('aria-describedby', [previous, id].filter(Boolean).join(' '));
    const observer = new MutationObserver(() => {
      if (!target.isConnected || target.dataset.tooltip !== text) setTarget(null);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tooltip'] });
    return () => {
      observer.disconnect();
      highlight?.classList.remove(styles.activeControl);
      if (previous === null) target.removeAttribute('aria-describedby');
      else target.setAttribute('aria-describedby', previous);
    };
  }, [target, text, id]);

  return target && text ? <div ref={labelRef} id={id} role="tooltip" className={styles.label} style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden' }}>{text}</div> : null;
}
