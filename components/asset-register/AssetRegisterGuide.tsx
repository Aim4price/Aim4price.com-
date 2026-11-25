'use client';

import { useId, useRef } from 'react';
import type { AssetSheetEntry } from './AssetSheetDialog';
import ShareModalCloseButton from './ShareModalCloseButton';
import AssetActionIcon from './AssetActionIcon';
import styles from './AssetRegisterGuide.module.css';

type GuideEntry = Exclude<AssetSheetEntry, 'choose'>;

const entries = [
  { stage: 'one', title: 'Add one asset', description: 'Get an Aim4price estimate or enter your own value.', icon: 'M12 5v14M5 12h14' },
  { stage: 'edit', title: 'Add in a sheet', description: 'Type or paste several assets, one per row.', icon: 'M3 4h18v16H3zM3 9h18M3 14h18M9 4v16' },
  { stage: 'file', title: 'Import a file', description: 'Match your Excel or CSV columns, then review the list.', icon: 'M12 15V3m-5 5 5-5 5 5M4 15v5h16v-5' },
] as const;

function GuideMark() {
  return <span className={styles.mark} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
    <path d="M3 5c3.5-.8 6.5-.4 9 1.3C14.5 4.6 17.5 4.2 21 5v14c-3.5-.8-6.5-.4-9 1.3-2.5-1.7-5.5-2.1-9-1.3zM12 6.3v14" />
  </svg></span>;
}

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
      <GuideMark />
      <span className={styles.launchCopy}><strong>Start here</strong><span>A quick guide to adding and managing assets.</span></span>
      <span className={styles.openLabel}>Open guide <span aria-hidden="true">→</span></span>
    </button>
    <dialog ref={dialog} id={id} className={styles.guideDialog} aria-labelledby={id + '-title'}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }}>
      <header className={styles.dialogHeader}>
        <GuideMark />
        <div><h2 id={id + '-title'}>Start here</h2><p>Your asset register guide</p></div>
        <ShareModalCloseButton aria-label="Close asset register guide" onClick={close} />
      </header>
      <div className={styles.guideContent}>
        <h3>Add assets to your register</h3>
        <div className={styles.choices}>{entries.map(entry =>
          <button type="button" key={entry.stage} data-entry={entry.stage} onClick={() => { close(); onAdd(entry.stage); }}>
            <span className={styles.choiceIcons} aria-hidden="true">
              <span className={styles.tileIcon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={entry.icon} /></svg></span>
              <span className={styles.arrow}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h11m-5-5 5 5-5 5" /></svg></span>
            </span>
            <strong>{entry.title}</strong><span>{entry.description}</span>
          </button>
        )}</div>
        <section className={styles.nextSteps}>
          <h3>Once your assets are in</h3>
          <div className={styles.notes}>
            <div><AssetActionIcon action="history" /><div><h4>Build an asset’s history</h4><p>Open <b>Manage</b> on an asset to record costs, fuel and maintenance.</p></div></div>
            <div><AssetActionIcon action="reports" /><div><h4>Review values and costs</h4><p>Open <b>Manage → Reports</b> to see what the asset is worth and what it costs to run.</p></div></div>
          </div>
        </section>
        <details className={styles.glossary}>
          <summary>What’s the difference between a register and an umbrella?</summary>
          <p>A <b>register</b> holds your asset list. An <b>umbrella</b> groups related assets, such as a tractor and planter. Each keeps its own records.</p>
        </details>
      </div>
    </dialog>
  </>;
}
