'use client';

import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from '../WebsitePortal';
import LeadActionDialog from '../leads/LeadActionDialog';
import styles from './AssetMessageReader.module.css';

/** Reading a notice never acknowledges or resolves it. Keep those actions outside. */
export default function AssetMessageReader({ title, assetTitle, className, children }: {
  title: string; assetTitle: string; className?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function show() { trigger.current?.focus(); setOpen(true); }
  return <>
    <div className={`${className || ''} ${styles.preview}`} onClick={event => {
      if ((event.target as Element).closest('a, button, input, select, textarea')) return;
      if (window.getSelection()?.toString()) return;
      event.stopPropagation(); show();
    }}>
      {children}
      <button ref={trigger} type="button" className={styles.readButton} aria-haspopup="dialog" aria-label={`Read message: ${title}`} onClick={event => { event.stopPropagation(); show(); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Read message
      </button>
    </div>
    {open && createPortal(<div onClick={event => event.stopPropagation()}>
      <LeadActionDialog title={title} assetTitle={assetTitle} onClose={() => setOpen(false)} closeLabel="Close message" className={styles.dialog}>
        <div className={styles.message}>{children}</div>
      </LeadActionDialog>
    </div>, document.body)}
  </>;
}
