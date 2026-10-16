'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from '../WebsitePortal';
import { useLeadDialog } from '../leads/useLeadDialog';
import ShareModalCloseButton from './ShareModalCloseButton';
import register from '../../app/asset-register/page.module.css';
import styles from './AssetMapRegisterDialog.module.css';

type Props = {
  options: { id: string; label: string; count: number }[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export default function AssetMapRegisterDialog({ options, selectedId, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const titleId = useId();
  const ref = useLeadDialog(onClose);
  const searchRef = useRef<HTMLInputElement>(null);
  const visible = options.filter(option => option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // The website portal mounts its host after commit.
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = previous; };
  }, []);

  return createPortal(
    <div className={styles.overlay} data-website-overlay>
      <div className={styles.backdrop} onClick={onClose} />
      <section id="asset-map-register-dialog" ref={ref} tabIndex={-1} className={styles.dialog}
        role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.header}>
          <div><h2 id={titleId}>Change Asset Register</h2><p>Choose which asset register to show on the map.</p></div>
          <ShareModalCloseButton onClick={onClose} aria-label="Close asset register picker" />
        </header>
        <label className={register.changeRegisterSearchWrap}>
          <svg className={register.changeRegisterSearchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
          <input ref={searchRef} type="search" aria-label="Search asset registers" placeholder="Search asset registers..." value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <div className={register.changeRegisterList} aria-label="Asset registers">
          {visible.map(option => <button key={option.id} type="button"
            className={`${register.changeRegisterCard} ${option.id === selectedId ? register.changeRegisterCardActive : ''}`}
            aria-pressed={option.id === selectedId} onClick={() => onSelect(option.id)}>
            <span className={register.changeRegisterCardText}><strong>{option.label}</strong><small>{option.count.toLocaleString('en-ZA')} mapped {option.count === 1 ? 'asset' : 'assets'}</small></span>
            <span className={register.changeRegisterCardAction}>{option.id === selectedId ? 'Current' : 'Show'}</span>
          </button>)}
          {!visible.length && <div className={register.changeRegisterEmptyState}><strong>No asset registers match your search.</strong><button type="button" className={styles.clear} onClick={() => setSearch('')}>Clear search</button></div>}
        </div>
      </section>
    </div>, document.body,
  );
}
