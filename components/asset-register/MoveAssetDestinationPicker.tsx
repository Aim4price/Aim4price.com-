'use client';

import { useEffect, useRef, useState } from 'react';
import RegisterPickerRow, { type RegisterPickerOption } from './RegisterPickerRow';
import styles from './MoveAssetDestinationPicker.module.css';
import choiceStyles from './InsideShareDialog.module.css';

type Destination = 'register' | 'umbrella';
type Option = RegisterPickerOption;

type Props = {
  assetName: string;
  assetDetails: string;
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
  const [step, setStep] = useState<'choice' | 'destination'>('choice');
  const choiceRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = props.options.find((option) => option.value === props.targetId);
  const query = search.trim().toLocaleLowerCase();
  const visible = props.options.filter((option) => `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(query));
  const isUmbrella = props.destination === 'umbrella';

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    if (step === 'destination') searchRef.current?.focus();
    else choiceRef.current?.focus();
  }, [step]);

  function chooseDestination(destination: Destination) {
    props.onDestinationChange(destination);
    setSearch('');
    setStep('destination');
  }

  function goBack() {
    if (props.busy) return;
    props.onSelect('');
    setSearch('');
    setStep('choice');
  }

  return (
    <div className={styles.overlay} data-website-overlay data-account-asset-modal>
      <div className={styles.backdrop} onClick={props.onClose} />
      <div ref={dialogRef} className={`${styles.dialog} ${step === 'choice' ? styles.choiceDialog : !isUmbrella ? styles.registerDialog : ''}`} role="dialog" aria-modal="true" aria-labelledby="move-asset-name" aria-describedby="move-destination-description" aria-busy={props.busy}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.stopPropagation(); if (step === 'destination') goBack(); else props.onClose(); return; }
          if (event.key !== 'Tab') return;
          const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? []);
          if (!nodes.length) { event.preventDefault(); return; }
          const first = nodes[0];
          const last = nodes[nodes.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <header className={styles.header}>
          <div>
            <p id="move-asset-name" className={styles.assetName}>{step === 'destination' && !isUmbrella ? 'Change Asset Register' : props.assetName}</p>
            <p id="move-destination-description" className={styles.assetDetails}>{step === 'destination' && !isUmbrella ? props.assetName : props.assetDetails.replace(/^Year model:/, 'Year Model:').replaceAll(' · ', ' • ')}</p>
          </div>
          <button type="button" className={styles.close} onClick={props.onClose} disabled={props.busy} aria-label="Close move asset modal" data-modal-close="true">×</button>
        </header>
        <div className={`${styles.body} ${step === 'destination' ? styles.pickerBody : ''}`}>
          {step === 'choice' ? (
            <div className={styles.types} role="group" aria-label="Move destination">
              <button ref={choiceRef} className={choiceStyles.card} data-tone="outside" type="button" disabled={props.busy} onClick={() => chooseDestination('register')}>
                <span className={choiceStyles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span>
                <span className={choiceStyles.copy}><strong>Asset Register</strong><small>Move to another asset register.</small></span>
              </button>
              {props.canUseUmbrellas ? <button className={choiceStyles.card} type="button" disabled={props.busy} onClick={() => chooseDestination('umbrella')}>
                <span className={choiceStyles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 18 0H3ZM12 3v16a2 2 0 0 0 4 0M8 12c0-5 2-9 4-9s4 4 4 9"/></svg></span>
                <span className={choiceStyles.copy}><strong>Umbrella</strong><small>Group with assets under an umbrella.</small></span>
              </button> : null}
            </div>
          ) : <>
          <div className={styles.listHeading}><h4>{isUmbrella ? 'Available umbrellas' : 'Available asset registers'}</h4><span>{props.loading ? 'Loading' : `${visible.length} available`}</span></div>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
          <input ref={searchRef} className={styles.search} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isUmbrella ? 'Search umbrellas or registers...' : 'Search asset registers...'} aria-label={isUmbrella ? 'Search umbrellas' : 'Search asset registers'} disabled={props.busy} />
          </div>
          {props.loading ? <p className={styles.empty} role="status">Loading umbrellas...</p>
            : props.loadError ? <div className={styles.empty} role="alert"><p>{props.loadError}</p><button type="button" onClick={props.onRetry}>Try again</button></div>
            : visible.length ? <div className={styles.options} role="group" aria-label={isUmbrella ? 'Target umbrella' : 'Target asset register'}>
              {visible.map((option) => !isUmbrella ? <RegisterPickerRow key={option.value} option={option} selected={props.targetId === option.value} disabled={props.busy} onSelect={props.onSelect} /> : <button key={option.value} type="button" className={styles.option} aria-pressed={props.targetId === option.value} disabled={props.busy} onClick={() => props.onSelect(option.value)}>
                <span className={styles.optionCopy}><strong>{option.label}</strong><small>{option.description}</small></span><span className={styles.selection} aria-hidden="true">{props.targetId === option.value ? 'Selected' : 'Select'}</span>
              </button>)}
            </div>
            : <div className={styles.empty}>
              {query ? <><p>No destinations match “{search}”.</p><button type="button" onClick={() => setSearch('')}>Clear search</button></>
                : isUmbrella ? <p>No other umbrellas are available. Create one using the umbrella button beside an asset.</p>
                : <><p>No other asset registers are available.</p><a href={props.managementHref}>Create an asset register</a></>}
            </div>}
          </>}
        </div>
        <footer className={styles.footer}>
          {step === 'destination' ? <div className={styles.confirmation} aria-live="polite">
            {selected ? <><span>{isUmbrella ? 'Selected umbrella' : 'Selected asset register'}</span><strong>{selected.label}</strong></> : <span>Select a destination to continue.</span>}
            {props.error ? <p className={styles.error} role="alert">{props.error}</p> : null}
          </div> : null}
          <div className={styles.actions}>
            {step === 'destination' ? <button type="button" onClick={goBack} disabled={props.busy}>Back</button> : null}<button type="button" onClick={props.onClose} disabled={props.busy}>Cancel</button>{step === 'destination' ? <button type="button" className={styles.primary} onClick={props.onMove} disabled={!selected || props.busy || props.loading || Boolean(props.loadError)}>{props.busy ? 'Moving...' : isUmbrella ? 'Move to Umbrella' : 'Move asset'}</button> : null}</div>
        </footer>
      </div>
    </div>
  );
}
