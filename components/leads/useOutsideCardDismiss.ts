'use client';

import { useEffect, useRef } from 'react';
import { isViewportScrollbarInteraction } from '../../lib/viewport-scrollbar';

/** Match the owner register: collapse the open card, preserving overlay interactions. */
export function useOutsideCardDismiss(open: boolean, onClose: () => void) {
  const cardRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (isViewportScrollbarInteraction(event)) return;
      const target = event.target;
      if (!(target instanceof Element) || !cardRef.current) return;
      if (cardRef.current.contains(target)) return;
      if (target.closest('[role="dialog"], dialog[open], [data-website-overlay], [role="listbox"]')) return;
      // A portal can sit outside the card. Keep its parent expanded until it closes.
      const overlays = document.querySelectorAll<HTMLElement>('[role="dialog"], dialog[open], [data-website-overlay]');
      if (Array.from(overlays).some(node => node.getClientRects().length > 0)) return;
      closeRef.current();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return cardRef;
}
