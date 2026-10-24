'use client';
import AssetChooseIcon from '../AssetChooseIcon';
import AssetPickerDetail from '../AssetPickerDetail';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from '../WebsitePortal';
import { useLeadDialog } from '../leads/useLeadDialog';
import ShareModalCloseButton from './ShareModalCloseButton';
import AssetSerialNumber from '../AssetSerialNumber';
import picker from '../AssetPicker.module.css';
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
    <section ref={ref} tabIndex={-1} className={`${frame.dialog} ${picker.modal}`} data-asset-choice-modal="true" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className={frame.header} data-asset-choice-header="true">
        <div><h2 id={titleId}>Choose asset to map</h2><p>Select a saved asset, then set its location.</p></div>
        <ShareModalCloseButton onClick={onClose} aria-label="Close asset picker" />
      </header>
      <div data-asset-choice-toolbar="true">
        <input ref={searchRef} type="search" aria-label="Search assets" placeholder="Search name, register, serial or registration" value={search} onChange={event => setSearch(event.target.value)} />
      </div>
      <div className={styles.list} data-asset-choice-list="true" aria-label="Saved assets">
        {visible.map(asset => <button key={asset.id} type="button" className={styles.asset} data-asset-choice-row="true" onClick={() => onSelect(asset.id)}>
          <span className={styles.copy} data-asset-choice-copy="true"><strong>{asset.title}</strong><small data-asset-choice-meta="true">{asset.subtitle}</small><AssetPickerDetail>{asset.register}</AssetPickerDetail><AssetSerialNumber value={asset.serial} /><small className={asset.mapped ? styles.mapped : styles.unmapped}>{asset.mapped ? 'Already mapped' : 'No location saved'}</small></span>
          <AssetChooseIcon />
        </button>)}
        {!visible.length && <div className={styles.empty}><strong>{assets.length ? 'No matching assets' : 'No saved assets yet'}</strong><p>{assets.length ? 'Try another name, register or serial number.' : 'Add an asset to your register before placing it on the map.'}</p>{query && <button type="button" className={frame.clear} onClick={() => setSearch('')}>Clear search</button>}</div>}
      </div>
    <footer data-asset-choice-footer="true"><button type="button" onClick={onClose}>Cancel</button></footer>
    </section>
  </div>, document.body);
}
