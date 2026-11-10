'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AssetPickerDetail from '../../components/AssetPickerDetail';
import AssetSerialNumber from '../../components/AssetSerialNumber';
import shared from '../../components/AssetPicker.module.css';
import styles from './owner-login-sections.module.css';
export type AccessChoice = { id: string; title: string; detail?: string; meta?: string; serialNumber?: string };
export default function OwnerAccessPicker({ title, description, options, selected, onConfirm, onClose, compact = false, standardAssets = false }: { standardAssets?: boolean; compact?: boolean; title: string; description: string; options: AccessChoice[]; selected: string[]; onConfirm: (ids: string[]) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(selected);
  const [search, setSearch] = useState('');
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => previous?.focus(); }, []);
  const filtered = options.filter(option => `${option.title} ${option.detail || ''} ${option.meta || ''} ${option.serialNumber || ''}`.toLowerCase().includes(search.toLowerCase()));
  return createPortal(<dialog ref={dialog} className={`${styles.picker} ${shared.modal} ${compact && !standardAssets ? styles.compactPicker : ''} ${standardAssets ? styles.standardAssetPicker : ''}`} data-asset-choice-modal="true" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}>
    <header className={styles.pickerHeader} data-asset-choice-header={standardAssets || undefined}><div><h2>{title}</h2><p>{description}</p></div><button type="button" onClick={onClose} aria-label="Close selection" data-modal-close="true">×</button></header>
    <div data-asset-choice-toolbar="true"><input type="search" aria-label={`Search ${title.toLowerCase()}`} placeholder={standardAssets ? "Search assets or serial numbers..." : "Search…"} value={search} onChange={event => setSearch(event.target.value)}/><button type="button" onClick={() => setDraft([...new Set([...draft, ...filtered.map(option => option.id)])])}>{search.trim() ? 'Select matches' : 'Select all'}</button><button type="button" onClick={() => setDraft([])}>Clear</button></div>
    <div data-asset-choice-list="true" data-asset-choice-surface="true">{filtered.map(option => <label key={option.id} data-asset-choice-row="true" data-asset-choice-selected={draft.includes(option.id) ? 'true' : undefined}><input type="checkbox" className={standardAssets ? shared.checkbox : undefined} checked={draft.includes(option.id)} onChange={() => setDraft(current => current.includes(option.id) ? current.filter(id => id !== option.id) : [...current, option.id])}/><span data-asset-choice-copy="true"><strong>{option.title}</strong>{standardAssets ? <>{option.meta ? <small data-asset-choice-meta="true">{option.meta}</small> : null}<AssetPickerDetail>{option.detail || "Asset"}</AssetPickerDetail><AssetSerialNumber value={option.serialNumber} /></> : option.detail ? <small data-asset-choice-meta="true">{option.detail}</small> : null}</span>{standardAssets ? <span className={`${shared.select} ${shared.multi}`} data-asset-choice-value="true" aria-hidden="true"><i>{draft.includes(option.id) ? "✓" : ""}</i></span> : null}</label>)}{!filtered.length ? <p>No matches found.</p> : null}</div>
    <footer className={styles.pickerFooter} data-asset-choice-footer={standardAssets || undefined}><span>{draft.length} selected</span><button type="button" onClick={onClose}>Cancel</button><button type="button" className={styles.primary} data-asset-choice-action="primary" onClick={() => onConfirm(draft)}>Confirm selection</button></footer>
  </dialog>, document.body);
}
