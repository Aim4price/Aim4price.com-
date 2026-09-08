'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './valuation-flow-polish.module.css';

const WIZARD_CARD_ID = 'valuation-wizard-card';
const FAMILY_SEARCH_LABEL = /^Search (equipment type|vehicle type)$/i;
const FAMILY_MODAL_TITLE_ID = 'valuation-family-modal-title';
const FAMILY_MODAL_DESCRIPTION_ID = 'valuation-family-modal-description';

type FamilyPickerNodes = {
  card: HTMLElement;
  searchInput: HTMLInputElement;
  trigger: HTMLButtonElement;
  typeLabel: string;
};

type FamilyOption = {
  id: string;
  label: string;
  meta: string;
  selected: boolean;
  searchText: string;
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

function optionLabelParts(button: HTMLButtonElement): { label: string; meta: string } {
  const content = button.querySelector<HTMLElement>(':scope > span') ?? button.querySelector<HTMLElement>('span');
  const metaNode = content?.querySelector<HTMLElement>('small') ?? null;
  const metaRaw = metaNode?.textContent?.trim() ?? '';
  const meta = metaRaw.replace(/^·\s*/, '').trim();
  const directLabel = content
    ? Array.from(content.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ')
        .trim()
    : '';
  const fallback = (content?.textContent ?? button.textContent ?? '').replace(metaRaw, '').replace(/\s+/g, ' ').trim();
  return { label: directLabel || fallback || 'Unnamed family', meta };
}

function sameOptions(left: FamilyOption[], right: FamilyOption[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((option, index) => {
    const candidate = right[index];
    return Boolean(candidate)
      && option.id === candidate.id
      && option.label === candidate.label
      && option.meta === candidate.meta
      && option.selected === candidate.selected;
  });
}

export default function ValuationFlowPolish() {
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [familyOptions, setFamilyOptions] = useState<FamilyOption[]>([]);
  const [familySearch, setFamilySearch] = useState('');
  const [familyTypeLabel, setFamilyTypeLabel] = useState('equipment type');
  const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);
  const pickerRef = useRef<FamilyPickerNodes | null>(null);
  const optionButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const familyModalOpenRef = useRef(false);
  const modalRef = useRef<HTMLElement | null>(null);
  const modalSearchRef = useRef<HTMLInputElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const visibleFamilyOptions = useMemo(() => {
    const terms = familySearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return familyOptions;
    return familyOptions.filter((option) => terms.every((term) => option.searchText.includes(term)));
  }, [familyOptions, familySearch]);

  useLayoutEffect(() => {
    let guardedWizard: HTMLElement | null = null;
    let originalScrollIntoView: HTMLElement['scrollIntoView'] | null = null;
    let previousHtmlOverflow = '';
    let previousBodyOverflow = '';
    let scrollLocked = false;

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
      if (guardedWizard && originalScrollIntoView) guardedWizard.scrollIntoView = originalScrollIntoView;
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
      picker.card.classList.remove(styles.familyPicker);
      picker.card.removeAttribute('data-valuation-family-picker');
      picker.card.removeAttribute('data-valuation-family-source-open');
      picker.card.removeAttribute('data-valuation-family-modal');
      picker.card.removeAttribute('data-valuation-family-title');
      picker.card.removeAttribute('role');
      picker.card.removeAttribute('aria-modal');
      picker.card.removeAttribute('aria-label');
      picker.card.removeAttribute('tabindex');
      picker.trigger.removeAttribute('data-valuation-family-close');
      if (picker.trigger.getAttribute('aria-label') === 'Close family selector') picker.trigger.removeAttribute('aria-label');
    };

    const captureFamilyOptions = (picker: FamilyPickerNodes) => {
      const buttons = Array.from(picker.card.querySelectorAll<HTMLButtonElement>('button')).filter((button) =>
        button !== picker.trigger
        && !button.disabled
        && Boolean(button.querySelector('span')),
      );
      const buttonMap = new Map<string, HTMLButtonElement>();
      const options = buttons.map((button, index) => {
        const { label, meta } = optionLabelParts(button);
        const id = `family-option-${index}`;
        buttonMap.set(id, button);
        return {
          id,
          label,
          meta,
          selected: button.className.includes('equipmentDropdownOptionActive') || button.getAttribute('aria-pressed') === 'true',
          searchText: `${label} ${meta}`.toLowerCase(),
        } satisfies FamilyOption;
      });

      optionButtonsRef.current = buttonMap;
      setFamilyOptions((current) => sameOptions(current, options) ? current : options);
    };

    const closePortalState = () => {
      if (!familyModalOpenRef.current) return;
      familyModalOpenRef.current = false;
      setFamilyModalOpen(false);
      optionButtonsRef.current = new Map();
      setFamilyOptions([]);
      window.requestAnimationFrame(() => {
        const target = returnFocusRef.current;
        if (target?.isConnected) target.focus({ preventScroll: true });
        returnFocusRef.current = null;
      });
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
        closePortalState();
        unlockDocumentScroll();
        return;
      }

      nextPicker.card.classList.add(styles.familyPicker);
      nextPicker.card.setAttribute('data-valuation-family-picker', 'true');
      const isOpen = nextPicker.trigger.getAttribute('aria-expanded') === 'true';

      if (isOpen) {
        nextPicker.card.setAttribute('data-valuation-family-source-open', 'true');
        captureFamilyOptions(nextPicker);
        lockDocumentScroll();

        if (!familyModalOpenRef.current) {
          const activeElement = document.activeElement;
          returnFocusRef.current = activeElement instanceof HTMLElement && !nextPicker.card.contains(activeElement)
            ? activeElement
            : nextPicker.trigger;
          familyModalOpenRef.current = true;
          setFamilyTypeLabel(nextPicker.typeLabel);
          setFamilySearch(nextPicker.searchInput.value);
          setFamilyModalOpen(true);
        } else {
          setFamilyTypeLabel(nextPicker.typeLabel);
        }
      } else {
        nextPicker.card.removeAttribute('data-valuation-family-source-open');
        closePortalState();
        unlockDocumentScroll();
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
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = focusableElements(modal);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
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
      unlockDocumentScroll();
      clearPickerPresentation(pickerRef.current);
      pickerRef.current = null;
      optionButtonsRef.current = new Map();
      restoreWizardGuard();
    };
  }, []);

  useLayoutEffect(() => {
    if (!familyModalOpen) return undefined;
    const frame = window.requestAnimationFrame(() => {
      modalSearchRef.current?.focus({ preventScroll: true });
      modalSearchRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [familyModalOpen]);

  const closeFamilyModal = () => {
    const picker = pickerRef.current;
    if (!picker || picker.trigger.getAttribute('aria-expanded') !== 'true') return;
    picker.trigger.click();
  };

  const selectFamilyOption = (optionId: string) => {
    optionButtonsRef.current.get(optionId)?.click();
  };

  if (!familyModalOpen || !overlayHost) return null;

  const modalTitle = `Choose ${familyTypeLabel}`;
  const itemLabel = familyTypeLabel.toLowerCase().includes('vehicle') ? 'vehicle types' : 'equipment types';

  return createPortal(
    <div className={styles.familyOverlay} data-website-overlay data-valuation-family-modal-root="true">
      <button
        type="button"
        className={styles.familyBackdrop}
        aria-label="Close family selector"
        onClick={closeFamilyModal}
      />

      <section
        ref={modalRef}
        className={styles.familyModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={FAMILY_MODAL_TITLE_ID}
        aria-describedby={FAMILY_MODAL_DESCRIPTION_ID}
      >
        <header className={styles.familyModalHeader}>
          <div className={styles.familyModalHeading}>
            <span className={styles.familyModalKicker}>Aim4price catalogue</span>
            <h2 id={FAMILY_MODAL_TITLE_ID}>{modalTitle}</h2>
            <p id={FAMILY_MODAL_DESCRIPTION_ID}>Search or browse the available {itemLabel}.</p>
          </div>
          <button
            type="button"
            className={styles.familyModalClose}
            onClick={closeFamilyModal}
            aria-label="Close family selector"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className={styles.familySearchRow}>
          <label className={styles.familySearchField}>
            <span className={styles.srOnly}>Search {familyTypeLabel}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m20 20-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
            </svg>
            <input
              ref={modalSearchRef}
              type="search"
              value={familySearch}
              onChange={(event) => setFamilySearch(event.target.value)}
              placeholder={`Search ${familyTypeLabel}`}
              autoComplete="off"
            />
            {familySearch ? (
              <button type="button" onClick={() => setFamilySearch('')} aria-label="Clear family search">×</button>
            ) : null}
          </label>
          <span className={styles.familyResultCount} aria-live="polite">
            {visibleFamilyOptions.length} {visibleFamilyOptions.length === 1 ? 'result' : 'results'}
          </span>
        </div>

        <div className={styles.familyOptionsViewport}>
          {visibleFamilyOptions.length ? (
            <div className={styles.familyOptionsGrid}>
              {visibleFamilyOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.familyOption} ${option.selected ? styles.familyOptionSelected : ''}`}
                  aria-pressed={option.selected}
                  onClick={() => selectFamilyOption(option.id)}
                >
                  <span className={styles.familyOptionCopy}>
                    <strong>{option.label}</strong>
                    {option.meta ? <small>{option.meta}</small> : null}
                  </span>
                  <span className={styles.familyOptionArrow} aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.familyEmptyState} role="status">
              <strong>No matching {familyTypeLabel}</strong>
              <span>Try a broader search or clear the search field.</span>
              {familySearch ? <button type="button" onClick={() => setFamilySearch('')}>Clear search</button> : null}
            </div>
          )}
        </div>
      </section>
    </div>,
    overlayHost,
  );
}
