'use client';

import { useId, useRef } from 'react';
import type { AssetSheetEntry } from './AssetSheetDialog';
import ShareModalCloseButton from './ShareModalCloseButton';
import entryStyles from '../../app/dealer/parts/parts.module.css';
import styles from './AssetRegisterGuide.module.css';

type GuideEntry = Exclude<AssetSheetEntry, 'choose'>;

const entries = [
  { stage: 'one', tone: 'blue', title: 'Add one asset', description: 'Get an estimate or set a value.' },
  { stage: 'edit', tone: 'green', title: 'Add in a sheet', description: 'Type or paste your asset list.' },
  { stage: 'file', tone: 'amber', title: 'Import a file', description: 'Upload an Excel or CSV file.' },
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
      <header className={`${entryStyles.dialogHeader} ${styles.dialogHeader}`}>
        <div>
          <h2 id={id + '-title'}>Start here</h2>
          <p>How would you like to add your assets?</p>
        </div>
        <ShareModalCloseButton aria-label="Close asset register guide" onClick={close} />
      </header>
      <div className={styles.guideContent}>
        <div className={`${entryStyles.shareChoices} ${styles.choices}`}>
          {entries.map(entry => (
            <button type="button" key={entry.stage} className={styles.method} data-entry={entry.stage} data-tone={entry.tone} onClick={() => { close(); onAdd(entry.stage); }}>
              <span>
                <strong>{entry.title}</strong>
                <small>{entry.description}</small>
              </span>
            </button>
          ))}
        </div>
        <div className={styles.notes}>
          <section>
            <h3>Manage an asset</h3>
            <p>Log fuel, costs and maintenance in <strong>Manage</strong>.</p>
            <p>See values and running costs in <strong>Reports</strong>.</p>
          </section>
          <section>
            <h3>Group assets</h3>
            <p>Group a truck and trailer under one umbrella.</p>
            <p>Each keeps its own records in your register.</p>
          </section>
        </div>
      </div>
    </dialog>
  </>;
}
