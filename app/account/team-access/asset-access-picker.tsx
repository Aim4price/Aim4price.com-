'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import RegisterPickerRow from '../../../components/asset-register/RegisterPickerRow';
import shared from '../../../components/AssetPicker.module.css';
import destination from '../../../components/asset-register/MoveAssetDestinationPicker.module.css';
import styles from '../owner-login-sections.module.css';
import pickerStyles from './asset-access-picker.module.css';

type Option = { id: string; title: string; detail?: string; count?: number };
export default function AssetAccessPicker({ kind, options, selected, onClose, onConfirm }: {
  kind: 'umbrellas' | 'registers' | 'assets';
  options: Option[];
  selected: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(selected);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    searchInput.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const visible = options.filter(option => `${option.title} ${option.detail || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = (id: string) => setDraft(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const title = `Choose ${kind}`;
  return createPortal(<dialog ref={dialog} className={`${styles.picker} ${shared.modal}`} data-asset-choice-modal="true" aria-label={title}
    onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}>
    <header className={destination.header} data-asset-choice-header="true"><div><h2 className={destination.assetName}>{title}</h2><p className={destination.assetDetails}>{kind === 'umbrellas' ? 'Add the current assets in each umbrella.' : kind === 'registers' ? 'Include current and future assets in these registers.' : 'Choose the individual assets they can access.'}</p></div><button className={destination.close} type="button" onClick={onClose} aria-label="Close asset selection" data-modal-close="true">×</button></header>
    <div data-asset-choice-toolbar="true"><label className={pickerStyles.search}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/></svg><input ref={searchInput} type="search" aria-label={`Search ${kind}`} placeholder={`Search ${kind === 'registers' ? 'asset registers' : kind}...`} value={search} onChange={event => setSearch(event.target.value)}/></label><button type="button" onClick={() => setDraft(current => [...new Set([...current, ...visible.map(option => option.id)])])}>Select all</button><button type="button" onClick={() => setSearch('')}>Clear</button></div>
    <div data-asset-choice-list="true" data-asset-choice-surface="true">
      {visible.map(option => kind === 'assets' ? <button type="button" key={option.id} data-asset-choice-row="true" data-asset-choice-selected={draft.includes(option.id) ? 'true' : undefined} aria-pressed={draft.includes(option.id)} onClick={() => toggle(option.id)}><span data-asset-choice-copy="true"><strong>{option.title}</strong>{option.detail && <small data-asset-choice-meta="true">{option.detail}</small>}</span><span aria-hidden="true">{draft.includes(option.id) ? '✓' : '+'}</span></button> : <RegisterPickerRow key={option.id} option={{ value: option.id, label: option.title, icon: kind === 'umbrellas' ? 'umbrella' : 'folder', description: option.detail, detailLabel: kind === 'umbrellas' ? 'Grouped assets' : 'Assets', detailValue: String(option.count ?? 0) }} selected={draft.includes(option.id)} disabled={false} onSelect={toggle}/>)}
      {!visible.length && <p>{search ? 'No matches found.' : `No ${kind} available.`}</p>}
    </div>
    <footer className={styles.pickerFooter} data-asset-choice-footer="true"><span role="status">{draft.length} selected</span><button type="button" onClick={() => setDraft([])}>Deselect all</button><button type="button" onClick={onClose}>Cancel</button><button type="button" className={styles.primary} onClick={() => onConfirm(draft)}>Confirm selection</button></footer>
  </dialog>, document.body);
}
