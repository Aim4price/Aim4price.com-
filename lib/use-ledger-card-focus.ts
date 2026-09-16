'use client';

import { useEffect, useState } from 'react';
import { isViewportScrollbarInteraction } from './viewport-scrollbar';

/** Match Asset Register's outside-click dismissal without closing child dialogs. */
export function useLedgerCardFocus(scope: string) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const findCard = () => Array.from(document.querySelectorAll<HTMLElement>('[data-ledger-card]'))
    .find(card => card.dataset.ledgerCard === `${scope}:${expandedId}`);

  useEffect(() => {
    if (expandedId && !findCard()) setExpandedId(null);
  });

  useEffect(() => {
    if (!expandedId) return;
    const card = findCard();
    if (!card) return;
    function outside(event: PointerEvent) {
      if (isViewportScrollbarInteraction(event)) return;
      const target = event.target;
      if (!(target instanceof Element) || card!.contains(target)) return;
      const dialog = target.closest('[role="dialog"], [data-website-overlay]');
      if (dialog && !dialog.contains(card!)) return;
      setExpandedId(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // Let any open modal handle Escape first.
      if (Array.from(document.querySelectorAll('[role="dialog"], [data-website-overlay]')).some(dialog => !dialog.contains(card!))) return;
      setExpandedId(null);
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [scope, expandedId]);
  return [expandedId, setExpandedId] as const;
}
