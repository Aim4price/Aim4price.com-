'use client';

import { useEffect, useRef } from 'react';
import accountStyles from '../app/account/page.module.css';
import styles from './AssetFilterDialog.module.css';

// Read across each row, keeping related choices together as in the filter preview.
const CHOICE_ORDER = [
  'insured', 'not-insured', 'marketplace',
  'financed', 'not-financed', 'aim4price-value',
  'licensed', 'not-licensed', 'license-not-applicable',
  'mapped', 'not-mapped', 'manual-value',
  'highest-value', 'lowest-value', 'property',
  'highest-replacement-price', 'lowest-replacement-price', 'no-property',
];

export type FilterChoice<K extends string> = { value: K; label: string };
export type FilterGroup<K extends string> = { label: string; section: 'status' | 'details'; options: FilterChoice<K>[] };

export function replaceFilterGroup<K extends string>(current: K[], options: FilterChoice<K>[], value: K | ''): K[] {
  const remaining = current.filter((key) => !options.some((option) => option.value === key));
  return value ? [...remaining, value] : remaining;
}

export default function AssetFilterDialog<K extends string>({ groups, options, selected, sort, sortOptions, resultCount, onGroupChange, onSortChange, onClear, onClose }: {
  groups: FilterGroup<K>[];
  options: FilterChoice<K>[];
  selected: K[];
  sort: K;
  sortOptions: FilterChoice<K>[];
  resultCount: number;
  onGroupChange: (options: FilterChoice<K>[], value: K | '') => void;
  onSortChange: (value: K) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previousFocus?.focus();
  }, []);
  const activeCount = selected.length + (sort !== sortOptions[0].value ? 1 : 0);
  const choices = options
    .filter((option) => option.value !== sortOptions[0].value)
    .sort((a, b) => {
      const rank = (value: string) => {
        const index = CHOICE_ORDER.indexOf(value);
        return index < 0 ? CHOICE_ORDER.length : index;
      };
      return rank(a.value) - rank(b.value);
    });

  return (
    <div className={styles.overlay} data-website-overlay>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <section ref={dialogRef} id="asset-register-filter-modal" className={`${styles.dialog} ${accountStyles.modalTheme}`} role="dialog" aria-modal="true" aria-labelledby="asset-register-filter-title" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select'));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <header className={styles.header}>
          <div><h3 id="asset-register-filter-title">Filter assets</h3><p>Choose which assets to include.</p><span className={styles.resultAnnouncement} aria-live="polite">{resultCount} {resultCount === 1 ? 'asset' : 'assets'} found</span></div>
          <button type="button" className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} onClick={onClose} aria-label="Close asset filters">×</button>
        </header>
        <div className={styles.body}>
          <button type="button" className={styles.all} aria-pressed={!activeCount} onClick={onClear}>All Assets</button>
          <div className={styles.choices}>
            {choices.map((option) => {
              const group = groups.find((item) => item.options.some((choice) => choice.value === option.value));
              const active = group ? selected.includes(option.value) : sort === option.value;
              const label = option.value === 'property' ? 'Property' : option.value === 'no-property' ? 'No property' : option.label;
              return <button type="button" className={styles.choice} key={option.value} title={label !== option.label ? option.label : undefined} aria-pressed={active} onClick={() => {
                if (group) onGroupChange(group.options, active ? '' : option.value);
                else onSortChange(active ? sortOptions[0].value : option.value);
              }}>{label}</button>;
            })}
          </div>
        </div>
        <footer className={styles.footer}>
          <button type="button" className={styles.clear} onClick={onClear} disabled={!activeCount}>Clear filters</button>
          <button type="button" className={styles.done} onClick={onClose}>Done</button>
        </footer>
      </section>
    </div>
  );
}
