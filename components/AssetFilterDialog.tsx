'use client';

import { useState } from 'react';
import styles from './FilterFlow.module.css';
import FilterFlow, { FilterQuestion } from './FilterFlow';

export type FilterChoice<K extends string> = { value: K; label: string };
export type FilterGroup<K extends string> = { label: string; section: 'status' | 'details'; options: FilterChoice<K>[] };

export function replaceFilterGroup<K extends string>(current: K[], options: FilterChoice<K>[], value: K | ''): K[] {
  const remaining = current.filter((key) => !options.some((option) => option.value === key));
  return value ? [...remaining, value] : remaining;
}

export default function AssetFilterDialog<K extends string>({ groups, selected, sort, sortOptions, onGroupChange, onSortChange, onClear, onClose }: {
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
  const [draft, setDraft] = useState(selected);
  const [draftSort, setDraftSort] = useState(sort);
  return <FilterFlow overview applyLabel="Show matching assets" title="Filter assets" onClose={onClose} onClear={() => {
    setDraft([]);
    setDraftSort(sortOptions[0].value);
    onClear();
  }} onApply={() => {
    groups.forEach((group) => onGroupChange(group.options, draft.find((value) => group.options.some((option) => option.value === value)) ?? ''));
    onSortChange(draftSort);
    onClose();
  }}>
    {groups.map((group) => <FilterQuestion key={group.label} label={group.label} value={draft.find((value) => group.options.some((option) => option.value === value)) ?? ''} options={[{ value: '', label: 'All' }, ...group.options]} onChange={(value) => setDraft((current) => replaceFilterGroup(current, group.options, value as K | ''))} />)}
    <FilterQuestion label="Sort by" value={draftSort} options={sortOptions} onChange={(value) => setDraftSort(value as K)} />
  </FilterFlow>;
}

export function ActiveAssetFilters<K extends string>({ selected, sort, options, sortOptions, onRemove, onResetSort, onClear }: {
  selected: K[];
  sort: K;
  options: FilterChoice<K>[];
  sortOptions: FilterChoice<K>[];
  onRemove: (value: K) => void;
  onResetSort: () => void;
  onClear: () => void;
}) {
  const sorted = sort !== sortOptions[0]?.value;
  if (!selected.length && !sorted) return null;
  return <div className={styles.activeFilters} role="group" aria-label="Active asset filters">
    <span className={styles.activeLabel}>Showing</span>
    {selected.map((value) => {
      const label = options.find((option) => option.value === value)?.label ?? value;
      return <button key={value} type="button" onClick={() => onRemove(value)} aria-label={`Remove filter: ${label}`}>{label}<span aria-hidden="true">×</span></button>;
    })}
    {sorted ? <button type="button" onClick={onResetSort} aria-label="Reset asset sorting">Sort: {sortOptions.find((option) => option.value === sort)?.label}<span aria-hidden="true">×</span></button> : null}
    <button type="button" className={styles.clearAll} onClick={onClear}>Clear all</button>
  </div>;
}
