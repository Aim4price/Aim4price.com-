'use client';
import {useState} from 'react';
import ShareHistory from './ShareHistory';
import { AssetShareDestinationPicker } from './AssetExternalShare';
import AssetAccessSettingsDialog from './AssetAccessSettingsDialog';

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
export default function ShareDestinationDialog({ assetIds=[], umbrellaId, kind, subject, serialNumber, disabled = false, onClose, onSendLink, onInside, onOutside }: Props) {
  const [history,setHistory]=useState(false);
  return (
    <AssetAccessSettingsDialog title={history ? 'Sharing history' : `Share ${kind === 'register' ? 'asset register' : kind}`} assetTitle={subject} onClose={()=>{if(!disabled) onClose();}}>
        {history ? <ShareHistory assetIds={assetIds} umbrellaId={umbrellaId} subject={subject} onBack={()=>setHistory(false)}/> : <div className={styles.destinationBody}>
          {serialNumber && <p className={base.liveNote}>Serial: {serialNumber}</p>}
          {kind === 'umbrella' && <p className={base.liveNote}>Live links include assets added to this umbrella later. Removed assets stop appearing.</p>}
          <AssetShareDestinationPicker onSendLink={onSendLink} onInside={onInside} onOutside={onOutside} disabled={disabled} />
          {(assetIds.length > 0 || umbrellaId) && <div className={base.historyActions}><button type="button" disabled={disabled} onClick={()=>setHistory(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2" /></svg><span>History</span><span className={base.historyHint}>Manage shared links</span><span aria-hidden="true">→</span></button></div>}
        </div>}
    </AssetAccessSettingsDialog>
  );
}
