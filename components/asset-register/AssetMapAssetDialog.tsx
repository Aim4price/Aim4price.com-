'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from '../WebsitePortal';
import { useLeadDialog } from '../leads/useLeadDialog';
import ShareModalCloseButton from './ShareModalCloseButton';
import ShareNextIcon from './ShareNextIcon';
import frame from './AssetMapRegisterDialog.module.css';
import styles from './AssetMapAssetDialog.module.css';

export type MapAssetOption = {
  id: string; title: string; subtitle: string; register: string;
  serial: string; registration: string; mapped: boolean;
};

type Props = { assets: MapAssetOption[]; onSelect: (id: string) => void; onClose: () => void };

export default function AssetMapAssetDialog({ assets, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const titleId = useId();
  const ref = useLeadDialog(onClose);
  const searchRef = useRef<HTMLInputElement>(null);
  const query = search.trim().toLocaleLowerCase();
  const visible = assets.filter(asset => [asset.title, asset.subtitle, asset.register, asset.serial, asset.registration]
    .join(' ').toLocaleLowerCase().includes(query))
    .sort((a, b) => Number(a.mapped) - Number(b.mapped) || a.title.localeCompare(b.title));

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = previous; };
  }, []);

  return createPortal(<div className={frame.overlay} data-website-overlay>
    <div className={frame.backdrop} onClick={onClose} />
    <section ref={ref} tabIndex={-1} className={`${frame.dialog} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className={frame.header}>
        <div><h2 id={titleId}>Choose asset to map</h2><p>Select a saved asset, then set its location.</p></div>
        <ShareModalCloseButton onClick={onClose} aria-label="Close asset picker" />
      </header>
      <label className={styles.search}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
        <input ref={searchRef} type="search" aria-label="Search assets" placeholder="Search name, register, serial or registration" value={search} onChange={event => setSearch(event.target.value)} />
      </label>
      <div className={styles.list} aria-label="Saved assets">
        {visible.map(asset => <button key={asset.id} type="button" className={styles.asset} onClick={() => onSelect(asset.id)}>
          <span className={styles.copy}><strong>{asset.title}</strong><span>{asset.subtitle}</span><small>{asset.register}{asset.serial ? ` · Serial / VIN: ${asset.serial}` : ''}</small><small className={asset.mapped ? styles.mapped : styles.unmapped}>{asset.mapped ? 'Already mapped' : 'No location saved'}</small></span>
          <ShareNextIcon />
        </button>)}
        {!visible.length && <div className={styles.empty}><strong>{assets.length ? 'No matching assets' : 'No saved assets yet'}</strong><p>{assets.length ? 'Try another name, register or serial number.' : 'Add an asset to your register before placing it on the map.'}</p>{query && <button type="button" className={frame.clear} onClick={() => setSearch('')}>Clear search</button>}</div>}
      </div>
    </section>
  </div>, document.body);
}
