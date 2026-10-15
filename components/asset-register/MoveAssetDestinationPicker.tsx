'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './MoveAssetDestinationPicker.module.css';

type Destination = 'register' | 'umbrella';
type Option = { value: string; label: string; description?: string };

type Props = {
  assetName: string;
  sourceName: string;
  destination: Destination;
  onDestinationChange: (value: Destination) => void;
  options: Option[];
  targetId: string;
  onSelect: (value: string) => void;
  canUseUmbrellas: boolean;
  loading: boolean;
  loadError: string;
  error: string;
  busy: boolean;
  managementHref: string;
  onRetry: () => void;
  onClose: () => void;
  onMove: () => void;
};

export default function MoveAssetDestinationPicker(props: Props) {
  const [search, setSearch] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = props.options.find((option) => option.value === props.targetId);
  const query = search.trim().toLocaleLowerCase();
  const visible = props.options.filter((option) => `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(query));
  const isUmbrella = props.destination === 'umbrella';

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    searchRef.current?.focus();
    return () => previous?.focus();
  }, []);

  return (
    <div className={styles.overlay} data-website-overlay data-account-asset-modal>
      <div className={styles.backdrop} onClick={props.onClose} />
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="asset-register-move-title" aria-describedby="move-destination-description" aria-busy={props.busy}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.stopPropagation(); props.onClose(); return; }
          if (event.key !== 'Tab') return;
          const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? []);
          if (!nodes.length) { event.preventDefault(); return; }
          const first = nodes[0];
          const last = nodes[nodes.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <header className={styles.header}>
          <div><h3 id="asset-register-move-title">Move asset</h3><p id="move-destination-description">Choose where this asset belongs.</p></div>
          <button type="button" className={styles.close} onClick={props.onClose} disabled={props.busy} aria-label="Close move asset modal">×</button>
        </header>
        <div className={styles.body}>
          <div className={styles.asset}><span>Moving</span><strong>{props.assetName}</strong><small>Current asset register: {props.sourceName}</small></div>
          <div className={styles.types} role="group" aria-label="Move destination">
            <button type="button" aria-pressed={!isUmbrella} disabled={props.busy} onClick={() => { props.onDestinationChange('register'); setSearch(''); }}>
              <strong>Asset register</strong><span>Transfer this asset to another register.</span>
            </button>
            {props.canUseUmbrellas ? <button type="button" aria-pressed={isUmbrella} disabled={props.busy} onClick={() => { props.onDestinationChange('umbrella'); setSearch(''); }}>
              <strong>Umbrella</strong><span>Group this asset while keeping its register.</span>
            </button> : null}
          </div>
          <div className={styles.listHeading}><h4>{isUmbrella ? 'Choose an umbrella' : 'Choose an asset register'}</h4><span>{props.loading ? 'Loading' : `${visible.length} available`}</span></div>
          <input ref={searchRef} className={styles.search} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isUmbrella ? 'Search umbrellas or registers...' : 'Search asset registers...'} aria-label={isUmbrella ? 'Search umbrellas' : 'Search asset registers'} disabled={props.busy} />
          {props.loading ? <p className={styles.empty} role="status">Loading umbrellas...</p>
            : props.loadError ? <div className={styles.empty} role="alert"><p>{props.loadError}</p><button type="button" onClick={props.onRetry}>Try again</button></div>
            : visible.length ? <div className={styles.options} role="group" aria-label={isUmbrella ? 'Target umbrella' : 'Target asset register'}>
              {visible.map((option) => <button key={option.value} type="button" className={styles.option} aria-pressed={props.targetId === option.value} disabled={props.busy} onClick={() => props.onSelect(option.value)}>
                <span className={styles.optionCopy}><strong>{option.label}</strong><small>{option.description}</small></span><span className={styles.selection}>{props.targetId === option.value ? 'Selected' : 'Select'}</span>
              </button>)}
            </div>
            : <div className={styles.empty}>
              {query ? <><p>No destinations match “{search}”.</p><button type="button" onClick={() => setSearch('')}>Clear search</button></>
                : isUmbrella ? <p>No other umbrellas are available. Create one using the umbrella button beside an asset.</p>
                : <><p>No other asset registers are available.</p><a href={props.managementHref}>Create an asset register</a></>}
            </div>}
        </div>
        <footer className={styles.footer}>
          <div className={styles.confirmation} aria-live="polite">
            {selected ? <><span>{isUmbrella ? 'Selected umbrella' : 'Selected asset register'}</span><strong>{selected.label}</strong><small>{isUmbrella ? 'The asset stays in its current register. An umbrella from another register becomes a combined umbrella.' : 'The asset leaves its current register. Membership of a register-specific umbrella is removed.'}</small></> : <span>Select a destination to continue.</span>}
            {props.error ? <p className={styles.error} role="alert">{props.error}</p> : null}
          </div>
          <div className={styles.actions}><button type="button" onClick={props.onClose} disabled={props.busy}>Cancel</button><button type="button" className={styles.primary} onClick={props.onMove} disabled={!selected || props.busy || props.loading || Boolean(props.loadError)}>{props.busy ? 'Moving...' : isUmbrella ? 'Move to Umbrella' : 'Move to register'}</button></div>
        </footer>
      </div>
    </div>
  );
}
