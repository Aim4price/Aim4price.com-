'use client';

import { useEffect } from 'react';

const controls = 'button, a[href], [role="button"], input[type="submit"], input[type="button"]';

function markStepAction(control: Element) {
  const visibleLabel = control instanceof HTMLInputElement ? control.value : control.textContent;
  const label = (visibleLabel?.trim() || control.getAttribute('aria-label') || '')
    .replace(/^[←‹«❮\s]+|[→›»❯\s]+$/g, '').toLowerCase();
  if (label === 'back' || label === 'continue') {
    control.setAttribute('data-step-action', label);
  } else {
    control.removeAttribute('data-step-action');
  }
}

// Dialogs can mount in portals and reuse a button for another action on the next step.
export default function StepActionStyles() {
  useEffect(() => {
    document.querySelectorAll(controls).forEach(markStepAction);
    const observer = new MutationObserver(records => {
      const changed = new Set<Element>();
      for (const record of records) {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        const control = target?.closest(controls + ', [data-step-action]');
        if (control) changed.add(control);
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches(controls)) changed.add(node);
          node.querySelectorAll(controls).forEach(child => changed.add(child));
        }
      }
      for (const control of changed) {
        if (control.matches(controls)) markStepAction(control);
        else control.removeAttribute('data-step-action');
      }
    });
    observer.observe(document.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['value', 'aria-label', 'role', 'href', 'type'],
    });
    return () => observer.disconnect();
  }, []);
  return null;
}
