'use client';
import { useEffect, useRef } from 'react';

/** Keep keyboard navigation in the front dialog and return to its opening button. */
export function useLeadDialog(onClose: () => void, busy = false) {
  const ref = useRef<HTMLElement | null>(null);
  const latest = useRef({onClose, busy});
  latest.current = {onClose, busy};
  useEffect(() => {
    const element = ref.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controls = () => Array.from(element?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(node => node.getClientRects().length);
    if (element && !element.contains(document.activeElement)) (controls()[0] || element).focus();
    function keydown(event: KeyboardEvent) {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"],dialog[open]')).filter(node => node.getClientRects().length);
      // Existing Leads children can occur earlier in the DOM but sit above Manage.
      const layer = (node: HTMLElement) => {
        let value = 0;
        for (let current: HTMLElement | null = node; current; current = current.parentElement) value = Math.max(value, Number.parseInt(getComputedStyle(current).zIndex, 10) || 0);
        return value;
      };
      dialogs.sort((a, b) => layer(a) - layer(b));
      if (dialogs.at(-1) !== element) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!latest.current.busy) latest.current.onClose();
      }
      if (event.key === 'Tab') {
        const items = controls(), first = items[0], last = items.at(-1);
        if (!first) { event.preventDefault(); element?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !element?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !element?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', keydown, true);
    return () => { document.removeEventListener('keydown', keydown, true); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  return ref;
}
