'use client';
import {useState} from 'react';
import ShareHistory from './ShareHistory';
import { AssetShareDestinationPicker } from './AssetExternalShare';
import ShareModalCloseButton from './ShareModalCloseButton';

import base from './ShareDestinationDialog.module.css';
import styles from './InsideShareDialog.module.css';

type Props = {
  assetIds?: string[];
  umbrellaId?: string;
  kind: 'register' | 'umbrella' | 'asset';
  titleId: string;
  subject: string;
  serialNumber?: string;
  disabled?: boolean;
  onClose: () => void;
  onSendLink: () => void;
  onInside: () => void;
  onOutside: () => void;
};

/** Shared entry point; the existing sharing flows still own recipients and sending. */
export default function ShareDestinationDialog({ assetIds=[], umbrellaId, kind, titleId, subject, serialNumber, disabled = false, onClose, onSendLink, onInside, onOutside }: Props) {
  const [history,setHistory]=useState(false);
  return (
    <div className={base.overlay} data-website-overlay>
      <div className={base.backdrop} data-website-overlay onClick={disabled ? undefined : onClose} />
      <section className={`${base.dialog} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={`${base.header} ${styles.header}`}>
          <div className={base.subject}>
            <span className={base.eyebrow}>{history ? 'Sharing history' : `Share ${kind === 'register' ? 'asset register' : kind}`}</span>
            <h3 id={titleId} tabIndex={-1} title={subject}>{subject}</h3>
            <p>{kind === 'asset' ? (serialNumber ? `Serial: ${serialNumber}` : 'Asset details') : `${assetIds.length} ${assetIds.length === 1 ? 'asset' : 'assets'}${kind === 'umbrella' ? ' in this umbrella' : ' selected'}`} · {history ? 'Manage your shared links' : 'Choose how to share'}</p>
          </div>
          <ShareModalCloseButton onClick={onClose} disabled={disabled} aria-label="Close share options" />
        </header>
        {history ? <ShareHistory assetIds={assetIds} umbrellaId={umbrellaId} onBack={()=>setHistory(false)}/> : <div className={styles.destinationBody}>
          {kind === 'umbrella' && <p className={base.liveNote}>Live links include assets added to this umbrella later. Removed assets stop appearing.</p>}
          <AssetShareDestinationPicker onSendLink={onSendLink} onInside={onInside} onOutside={onOutside} disabled={disabled} />
          {(assetIds.length > 0 || umbrellaId) && <div className={base.historyActions}><button type="button" disabled={disabled} onClick={()=>setHistory(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2" /></svg><span>History</span><span className={base.historyHint}>Open or revoke shared links</span><span aria-hidden="true">→</span></button></div>}
        </div>}
      </section>
    </div>
  );
}
