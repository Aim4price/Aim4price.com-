'use client';
import { AssetShareDestinationPicker } from './AssetExternalShare';
import ShareModalCloseButton from './ShareModalCloseButton';

import base from './ShareDestinationDialog.module.css';
import styles from './InsideShareDialog.module.css';

type Props = {
  kind: 'register' | 'umbrella' | 'asset';
  titleId: string;
  subject: string;
  disabled?: boolean;
  onClose: () => void;
  onSendLink: () => void;
  onInside: () => void;
  onOutside: () => void;
};

/** Shared entry point; the existing sharing flows still own recipients and sending. */
export default function ShareDestinationDialog({ kind, titleId, subject, disabled = false, onClose, onSendLink, onInside, onOutside }: Props) {
  return (
    <div className={base.overlay} data-website-overlay>
      <div className={base.backdrop} data-website-overlay onClick={disabled ? undefined : onClose} />
      <section className={`${base.dialog} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={`${base.header} ${styles.header}`}>
          <div>
            <h3 id={titleId} tabIndex={-1} title={subject}>Share {kind === 'register' ? 'asset register' : kind}</h3>
            <p>Choose how to share.</p>
          </div>
          <ShareModalCloseButton onClick={onClose} disabled={disabled} aria-label="Close share options" />
        </header>
        <div className={styles.destinationBody}>
          <AssetShareDestinationPicker onSendLink={onSendLink} onInside={onInside} onOutside={onOutside} disabled={disabled} />
        </div>
      </section>
    </div>
  );
}
