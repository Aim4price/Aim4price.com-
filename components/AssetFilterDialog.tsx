'use client';

import { useState } from 'react';
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
  return <FilterFlow title="Filter assets" onClose={onClose} onClear={() => {
    setDraft([]);
    setDraftSort(sortOptions[0].value);
    onClear();
  }} onApply={() => {
    groups.forEach((group) => onGroupChange(group.options, draft.find((value) => group.options.some((option) => option.value === value)) ?? ''));
    onSortChange(draftSort);
    onClose();
  }}>
    {groups.map((group) => <FilterQuestion key={group.label} label={group.label} value={draft.find((value) => group.options.some((option) => option.value === value)) ?? ''} options={[{ value: '', label: 'All assets' }, ...group.options]} onChange={(value) => setDraft((current) => replaceFilterGroup(current, group.options, value as K | ''))} />)}
    <FilterQuestion label="How should assets be sorted?" value={draftSort} options={sortOptions} onChange={(value) => setDraftSort(value as K)} />
  </FilterFlow>;
}
