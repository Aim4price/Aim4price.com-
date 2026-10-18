'use client';

import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from '../WebsitePortal';
import LeadActionDialog from '../leads/LeadActionDialog';
import styles from './AssetMessageReader.module.css';

/** Reading a notice never acknowledges or resolves it. Actions are explicit, both on the banner and in the reader. */
export default function AssetMessageReader({ title, assetTitle, className, children, actions }: {
  title: string; assetTitle: string; className?: string; children: ReactNode; actions?: ReactNode;
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
      <span aria-hidden="true" data-tooltip="Open message" className={styles.hoverAnchor} />
      {children}
      <button ref={trigger} type="button" className={styles.readButton} aria-haspopup="dialog" data-tooltip="Open message" aria-label={`Open message: ${title}`} onClick={event => { event.stopPropagation(); show(); }}>
        Open message
      </button>
    </div>
    {actions}
    {open && createPortal(<div onClick={event => event.stopPropagation()}>
      <LeadActionDialog title={title} assetTitle={assetTitle} onClose={() => setOpen(false)} closeLabel="Close message" className={styles.dialog} footer={actions ? <div className={styles.actions} onClick={event => {
          // Close the reader before an action opens its existing confirmation flow.
          const button = (event.target as Element).closest('button');
          if (button && !button.disabled) setOpen(false);
        }}>{actions}</div> : undefined}>
        <div className={styles.message}>{children}</div>
      </LeadActionDialog>
    </div>, document.body)}
  </>;
}
