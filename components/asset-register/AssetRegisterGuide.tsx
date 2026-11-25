'use client';

import { useId, useRef } from 'react';
import type { AssetSheetEntry } from './AssetSheetDialog';
import ShareModalCloseButton from './ShareModalCloseButton';
import styles from './AssetRegisterGuide.module.css';

type GuideEntry = Exclude<AssetSheetEntry, 'choose'>;

const entries = [
  { stage: 'one', title: 'Add one asset', description: 'Get an Aim4price estimate or enter your own value.' },
  { stage: 'edit', title: 'Add in a sheet', description: 'Type or paste your assets, one per row.' },
  { stage: 'file', title: 'Import a file', description: 'Upload an Excel or CSV list of assets.' },
] as const;

export default function AssetRegisterGuide({ onAdd }: { onAdd: (entry: GuideEntry) => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function close() {
    dialog.current?.close();
    trigger.current?.focus({ preventScroll: true });
  }

  return <>
    <button ref={trigger} type="button" className={styles.launcher} aria-haspopup="dialog" aria-controls={id}
      onClick={() => dialog.current?.showModal()}>
      <strong>Start here</strong>
      <span className={styles.openLabel}>Open guide</span>
    </button>
    <dialog ref={dialog} id={id} className={styles.guideDialog} aria-labelledby={id + '-title'}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }}>
      <header className={styles.dialogHeader}>
        <div>
          <h2 id={id + '-title'}>Start here</h2>
          <p>How would you like to add your assets?</p>
        </div>
        <ShareModalCloseButton aria-label="Close asset register guide" onClick={close} />
      </header>
      <div className={styles.guideContent}>
        <div className={styles.choices}>
          {entries.map(entry => (
            <button type="button" key={entry.stage} data-entry={entry.stage} onClick={() => { close(); onAdd(entry.stage); }}>
              <strong>{entry.title}</strong>
              <span>{entry.description}</span>
            </button>
          ))}
        </div>
        <div className={styles.notes}>
          <section>
            <h3>Manage an asset</h3>
            <p>Open <strong>Manage</strong> to record fuel, costs and maintenance. Choose <strong>Reports</strong> to see the asset’s value and running costs.</p>
          </section>
          <section>
            <h3>Group assets</h3>
            <p>A register is your asset list. An umbrella groups related assets, like a tractor and planter. Each keeps its own records.</p>
          </section>
        </div>
      </div>
    </dialog>
  </>;
}
