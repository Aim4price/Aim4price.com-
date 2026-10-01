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
  disabled?: boolean;
  onClose: () => void;
  onSendLink: () => void;
  onInside: () => void;
  onOutside: () => void;
};

/** Shared entry point; the existing sharing flows still own recipients and sending. */
export default function ShareDestinationDialog({ assetIds=[], umbrellaId, kind, titleId, subject, disabled = false, onClose, onSendLink, onInside, onOutside }: Props) {
  const [history,setHistory]=useState<'history'|'revoke'|null>(null);
  return (
    <div className={base.overlay} data-website-overlay>
      <div className={base.backdrop} data-website-overlay onClick={disabled ? undefined : onClose} />
      <section className={`${base.dialog} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={`${base.header} ${styles.header}`}>
          <div>
            <h3 id={titleId} tabIndex={-1} title={subject}>Share {kind === 'register' ? 'asset register' : kind}</h3>
            <p>{kind==='umbrella'?'Live umbrella links include assets added later. Removed assets stop appearing.':'Choose how to share.'}</p>
          </div>
          <ShareModalCloseButton onClick={onClose} disabled={disabled} aria-label="Close share options" />
        </header>
        {history ? <ShareHistory assetIds={assetIds} umbrellaId={umbrellaId} mode={history} onBack={()=>setHistory(null)}/> : <div className={styles.destinationBody}>
          <AssetShareDestinationPicker onSendLink={onSendLink} onInside={onInside} onOutside={onOutside} disabled={disabled} />
          {assetIds.length>0&&<div className={base.historyActions}><button type="button" disabled={disabled} onClick={()=>setHistory('history')}>History</button><button type="button" disabled={disabled} onClick={()=>setHistory('revoke')}>Revoke access</button></div>}
        </div>}
      </section>
    </div>
  );
}
