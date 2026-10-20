'use client';
import modalStyles from '../../components/estimate-modal.module.css';

import { submitCanonicalReportForm } from '../../lib/report-open';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BASIC_REPLACEMENT_SLIDER_STEP } from '../../lib/basic-estimate';
import {
  SALEABILITY_PDF_PLAN_SESSION_KEY,
  formatSaleabilityPdfPrice,
  parseSaleabilityPdfPlanSnapshot,
  saleabilityPdfPlanMatchesEstimate,
} from '../../lib/saleability-pdf';
import styles from './valuation-flow-polish.module.css';

function CategoryMenu({value, groups, onChange}: {value: string; groups: string[]; onChange: (value: string) => void}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const options = ['', ...groups];
  useLayoutEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({preventScroll: true});
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrap.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const close = () => { setOpen(false); trigger.current?.focus({preventScroll: true}); };
  return <div ref={wrap} className={styles.familyCategoryField} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  }}>
    <button ref={trigger} type="button" className={styles.familyCategoryTrigger} aria-label="Equipment category" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? 'equipment-category-list' : undefined} onClick={() => setOpen(current => !current)}>
      <span>{value || 'All categories'}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open ? <div ref={list} id="equipment-category-list" role="listbox" aria-label="Equipment categories" className={styles.familyCategoryMenu}>
      {options.map(option => <button key={option} type="button" role="option" aria-selected={value === option} tabIndex={value === option ? 0 : -1} onClick={() => { onChange(option); close(); }}>
        <span>{option || 'All categories'}</span>
        {value === option ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg> : null}
      </button>)}
    </div> : null}
  </div>;
}

const WIZARD_CARD_ID = 'valuation-wizard-card';
const FAMILY_SEARCH_LABEL = /^Search (equipment type|vehicle type)$/i;
const REPLACEMENT_SLIDER_LABEL = /Slide to replacement price/i;
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

function findReplacementPriceSlider(): HTMLInputElement | null {
  const wizard = document.getElementById(WIZARD_CARD_ID);
  if (!wizard) return null;

  return Array.from(wizard.querySelectorAll<HTMLInputElement>('input[type="range"]')).find((input) => {
    const label = input.closest('label');
    return Boolean(label && REPLACEMENT_SLIDER_LABEL.test(label.textContent ?? ''));
  }) ?? null;
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getClientRects().length > 0);
}

function optionLabelParts(button: HTMLButtonElement): { label: string; meta: string } {
  if (button.dataset.familyLabel) return { label: button.dataset.familyLabel, meta: button.dataset.familyGroup ?? '' };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function enrichEstimatePdfFormWithSaleabilityPrice(form: HTMLFormElement): void {
  try {
    const actionPath = new URL(form.action, window.location.href).pathname;
    if (actionPath !== '/api/valuation/report') return;

    const payloadInput = form.querySelector<HTMLInputElement>('input[name="payload"]');
    if (!payloadInput?.value) return;

    const payload = JSON.parse(payloadInput.value) as unknown;
    if (!isRecord(payload)) return;

    const snapshot = parseSaleabilityPdfPlanSnapshot(
      window.sessionStorage.getItem(SALEABILITY_PDF_PLAN_SESSION_KEY),
    );
    if (!snapshot || !saleabilityPdfPlanMatchesEstimate(snapshot, payload.machineTitle, payload.selectedValueExVat)) return;

    const rows = Array.isArray(payload.saleabilityRows) ? [...payload.saleabilityRows] : [];
    const withoutExistingPrice = rows.filter((row) => {
      if (!isRecord(row)) return true;
      return !/^Saleability price$/i.test(String(row.label ?? '').trim());
    });
    const priceRow = {
      label: 'Saleability price',
      value: formatSaleabilityPdfPrice(snapshot.saleabilityPriceExVat),
    };
    const gradeIndex = withoutExistingPrice.findIndex((row) =>
      isRecord(row) && /^Grade$/i.test(String(row.label ?? '').trim()),
    );

    if (gradeIndex >= 0) withoutExistingPrice.splice(gradeIndex + 1, 0, priceRow);
    else withoutExistingPrice.unshift(priceRow);

    payload.saleabilityRows = withoutExistingPrice;
    payloadInput.value = JSON.stringify(payload);
  } catch {
    // PDF download must remain available even if browser storage is unavailable or stale.
  }
}

export default function ValuationFlowPolish() {
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [familyOptions, setFamilyOptions] = useState<FamilyOption[]>([]);
  const [familySearch, setFamilySearch] = useState('');
  const [familyGroup, setFamilyGroup] = useState('');
  const optionsViewportRef = useRef<HTMLDivElement | null>(null);
  const [familyTypeLabel, setFamilyTypeLabel] = useState('equipment type');
  const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);
  const pickerRef = useRef<FamilyPickerNodes | null>(null);
  const optionButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const familyModalOpenRef = useRef(false);
  const modalRef = useRef<HTMLElement | null>(null);
  const modalSearchRef = useRef<HTMLInputElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const familyGroups = useMemo(() => Array.from(new Set(familyOptions.map(option => option.meta).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [familyOptions]);
  const visibleFamilyOptions = useMemo(() => {
    const normalise = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_/]/g, ' ').replace(/\s+/g, ' ').trim();
    const query = normalise(familySearch);
    const terms = query.split(' ').filter(Boolean);
    return familyOptions.filter(option => (!familyGroup || option.meta === familyGroup)
      && terms.every(term => normalise(option.searchText).includes(term)))
      .sort((a, b) => Number(normalise(b.label) === query) - Number(normalise(a.label) === query)
        || a.label.localeCompare(b.label, 'en', {numeric: true, sensitivity: 'base'}));
  }, [familyOptions, familySearch, familyGroup]);

  useLayoutEffect(() => { optionsViewportRef.current?.scrollTo({top: 0}); }, [familySearch, familyGroup]);

  useLayoutEffect(() => {
    const originalSubmit = HTMLFormElement.prototype.submit;
    const submitWithSaleabilityPrice = function submitWithSaleabilityPrice(this: HTMLFormElement) {
      if (new URL(this.action, window.location.href).pathname !== '/api/valuation/report') return originalSubmit.call(this);
      enrichEstimatePdfFormWithSaleabilityPrice(this);
      return submitCanonicalReportForm(this);
    };

    HTMLFormElement.prototype.submit = submitWithSaleabilityPrice;
    return () => {
      if (HTMLFormElement.prototype.submit === submitWithSaleabilityPrice) {
        HTMLFormElement.prototype.submit = originalSubmit;
      }
    };
  }, []);

  useLayoutEffect(() => {
    let guardedWizard: HTMLElement | null = null;
    let originalScrollIntoView: HTMLElement['scrollIntoView'] | null = null;
    let guardedReplacementSlider: HTMLInputElement | null = null;
    let originalReplacementStep = '';
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

    const restoreReplacementSlider = () => {
      if (guardedReplacementSlider?.isConnected) {
        guardedReplacementSlider.step = originalReplacementStep;
        guardedReplacementSlider.removeAttribute('data-basic-replacement-slider-step');
      }
      guardedReplacementSlider = null;
      originalReplacementStep = '';
    };

    const syncReplacementSliderStep = () => {
      const slider = findReplacementPriceSlider();
      if (slider === guardedReplacementSlider) return;

      restoreReplacementSlider();
      if (!slider) return;

      guardedReplacementSlider = slider;
      originalReplacementStep = slider.step;
      slider.step = String(BASIC_REPLACEMENT_SLIDER_STEP);
      slider.setAttribute('data-basic-replacement-slider-step', String(BASIC_REPLACEMENT_SLIDER_STEP));
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
      syncReplacementSliderStep();

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
          setFamilyGroup('');
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
      restoreReplacementSlider();
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
        className={`${styles.familyModal} ${modalStyles.surface}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={FAMILY_MODAL_TITLE_ID}
        aria-describedby={FAMILY_MODAL_DESCRIPTION_ID}
      >
        <header className={styles.familyModalHeader}>
          <div className={styles.familyModalHeading}>
            <h2 data-estimate-modal-title id={FAMILY_MODAL_TITLE_ID}>{modalTitle}</h2>
            <p id={FAMILY_MODAL_DESCRIPTION_ID}>Choose the closest match to your asset.</p>
          </div>
          <button
            type="button"
            className={`${styles.familyModalClose} ${modalStyles.close}`}
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
          {familyGroups.length > 1 ? <CategoryMenu value={familyGroup} groups={familyGroups} onChange={setFamilyGroup} /> : null}
        </div>
        <div className={styles.familyListHeading}>
          <strong>{familyGroup || `All ${familyTypeLabel === 'vehicle type' ? 'vehicles' : 'equipment'}`}</strong>
          <span className={styles.familyResultCount} aria-live="polite">{visibleFamilyOptions.length} {visibleFamilyOptions.length === 1 ? 'result' : 'results'} · A–Z</span>
        </div>
        <div ref={optionsViewportRef} className={styles.familyOptionsViewport}>
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
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.familyEmptyState} role="status">
              <strong>No matching {familyTypeLabel}</strong>
              <span>Try a shorter name or choose another category.</span>
              {familyGroup ? <button type="button" onClick={() => setFamilyGroup('')}>Search all categories</button> : null}
              {familySearch ? <button type="button" onClick={() => setFamilySearch('')}>Clear search</button> : null}
            </div>
          )}
        </div>

      </section>
    </div>,
    overlayHost,
  );
}


