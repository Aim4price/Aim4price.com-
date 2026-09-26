'use client';
import { useRef, type ReactNode } from 'react';
import { createPortal } from '../WebsitePortal';
import ShareModalCloseButton from './ShareModalCloseButton';
import styles from './ShareDisclosureDialog.module.css';

/** One disclosure surface for invitations and direct external sharing. */
export default function ShareDisclosureDialog({ title, titleId, descriptionId, closeLabel, onClose, children }: {
  title: string; titleId: string; descriptionId?: string; closeLabel: string;
  onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  return createPortal(<dialog
    ref={node => { dialog.current = node; if (node && !node.open) node.showModal(); }}
    className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onKeyDown={event => event.stopPropagation()}
    onCancel={event => event.stopPropagation()}
    onClose={onClose}
    onClick={event => {
      event.stopPropagation();
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close();
    }}
  >
    <header className={styles.header}>
      <h2 id={titleId}>{title}</h2>
      <ShareModalCloseButton aria-label={closeLabel} onClick={() => dialog.current?.close()} />
    </header>
    {children}
  </dialog>, document.body);
}
