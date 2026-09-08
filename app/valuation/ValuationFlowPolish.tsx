'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './valuation-flow-polish.module.css';

const WIZARD_CARD_ID = 'valuation-wizard-card';
const FAMILY_SEARCH_LABEL = /^Search (equipment type|vehicle type)$/i;

type FamilyPickerNodes = {
  card: HTMLElement;
  searchInput: HTMLInputElement;
  trigger: HTMLButtonElement;
  typeLabel: string;
};

function findFamilyPicker(): FamilyPickerNodes | null {
  const wizard = document.getElementById(WIZARD_CARD_ID);
  if (!wizard) return null;

  const label = Array.from(wizard.querySelectorAll<HTMLElement>('span')).find((candidate) =>
    FAMILY_SEARCH_LABEL.test(candidate.textContent?.trim() ?? ''),
  );
  if (!label) return null;

  let candidate: HTMLElement | null = label.parentElement;
  while (candidate && candidate !== wizard) {
    const searchInput = candidate.querySelector<HTMLInputElement>('input:not([type="hidden"])');
    const trigger = candidate.querySelector<HTMLButtonElement>('button[aria-expanded]');
    if (searchInput && trigger) {
      const typeLabel = (label.textContent?.trim() ?? 'Search equipment type').replace(/^Search\s+/i, '');
      return { card: candidate, searchInput, trigger, typeLabel };
    }
    candidate = candidate.parentElement;
  }

  return null;
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getClientRects().length > 0);
}

export default function ValuationFlowPolish() {
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);
  const pickerRef = useRef<FamilyPickerNodes | null>(null);
  const familyModalOpenRef = useRef(false);

  useLayoutEffect(() => {
    let guardedWizard: HTMLElement | null = null;
    let originalScrollIntoView: HTMLElement['scrollIntoView'] | null = null;
    let previousHtmlOverflow = '';
    let previousBodyOverflow = '';
    let scrollLocked = false;
    let focusFrame = 0;

    const lockDocumentScroll = () => {
      if (scrollLocked) return;
      previousHtmlOverflow = document.documentElement.style.overflow;
      previousBodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      scrollLocked = true;
    };

    const unlockDocumentScroll = () => {
      if (!scrollLocked) return;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      scrollLocked = false;
    };

    const restoreWizardGuard = () => {
      if (guardedWizard && originalScrollIntoView) {
        guardedWizard.scrollIntoView = originalScrollIntoView;
      }
      guardedWizard = null;
      originalScrollIntoView = null;
    };

    const guardWizardScroll = () => {
      const wizard = document.getElementById(WIZARD_CARD_ID);
      if (wizard === guardedWizard) return;

      restoreWizardGuard();
      if (!wizard) return;

      guardedWizard = wizard;
      originalScrollIntoView = wizard.scrollIntoView;
      wizard.scrollIntoView = () => undefined;
    };

    const clearPickerPresentation = (picker: FamilyPickerNodes | null) => {
      if (!picker) return;
      picker.card.removeAttribute('data-valuation-family-picker');
      picker.card.removeAttribute('data-valuation-family-modal');
      picker.card.removeAttribute('data-valuation-family-title');
      picker.card.removeAttribute('role');
      picker.card.removeAttribute('aria-modal');
      picker.card.removeAttribute('aria-label');
      picker.card.removeAttribute('tabindex');
      picker.trigger.removeAttribute('data-valuation-family-close');
      picker.trigger.removeAttribute('aria-label');
    };

    const syncFamilyPicker = () => {
      guardWizardScroll();

      const nextPicker = findFamilyPicker();
      if (pickerRef.current?.card !== nextPicker?.card) {
        clearPickerPresentation(pickerRef.current);
        pickerRef.current = nextPicker;
      } else if (nextPicker) {
        pickerRef.current = nextPicker;
      }

      if (!nextPicker) {
        if (familyModalOpenRef.current) {
          familyModalOpenRef.current = false;
          setFamilyModalOpen(false);
        }
        unlockDocumentScroll();
        return;
      }

      nextPicker.card.setAttribute('data-valuation-family-picker', 'true');
      const isOpen = nextPicker.trigger.getAttribute('aria-expanded') === 'true';

      if (isOpen) {
        const modalTitle = `Choose ${nextPicker.typeLabel}`;
        nextPicker.card.setAttribute('data-valuation-family-modal', 'true');
        nextPicker.card.setAttribute('data-valuation-family-title', modalTitle);
        nextPicker.card.setAttribute('role', 'dialog');
        nextPicker.card.setAttribute('aria-modal', 'true');
        nextPicker.card.setAttribute('aria-label', modalTitle);
        nextPicker.card.setAttribute('tabindex', '-1');
        nextPicker.trigger.setAttribute('data-valuation-family-close', 'true');
        nextPicker.trigger.setAttribute('aria-label', 'Close family selector');
        lockDocumentScroll();

        if (!familyModalOpenRef.current) {
          familyModalOpenRef.current = true;
          setFamilyModalOpen(true);
          window.cancelAnimationFrame(focusFrame);
          focusFrame = window.requestAnimationFrame(() => {
            pickerRef.current?.searchInput.focus({ preventScroll: true });
            pickerRef.current?.searchInput.select();
          });
        }
      } else {
        nextPicker.card.removeAttribute('data-valuation-family-modal');
        nextPicker.card.removeAttribute('data-valuation-family-title');
        nextPicker.card.removeAttribute('role');
        nextPicker.card.removeAttribute('aria-modal');
        nextPicker.card.removeAttribute('aria-label');
        nextPicker.card.removeAttribute('tabindex');
        nextPicker.trigger.removeAttribute('data-valuation-family-close');
        nextPicker.trigger.removeAttribute('aria-label');
        unlockDocumentScroll();

        if (familyModalOpenRef.current) {
          familyModalOpenRef.current = false;
          setFamilyModalOpen(false);
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const picker = pickerRef.current;
      if (!familyModalOpenRef.current || !picker) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        picker.trigger.click();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = focusableElements(picker.card);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !picker.card.contains(document.activeElement))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    setOverlayHost(document.getElementById('aim4price-website-overlays') ?? document.body);
    guardWizardScroll();
    syncFamilyPicker();

    const observer = new MutationObserver(syncFamilyPicker);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-expanded'],
    });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
      unlockDocumentScroll();
      clearPickerPresentation(pickerRef.current);
      pickerRef.current = null;
      restoreWizardGuard();
    };
  }, []);

  const closeFamilyModal = () => {
    const picker = pickerRef.current;
    if (!picker || picker.trigger.getAttribute('aria-expanded') !== 'true') return;
    picker.trigger.click();
  };

  if (!familyModalOpen || !overlayHost) return null;

  return createPortal(
    <button
      type="button"
      className={styles.familyBackdrop}
      aria-label="Close family selector"
      onClick={closeFamilyModal}
    />,
    overlayHost,
  );
}
