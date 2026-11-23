import assetStyles from '../../app/asset-register/page.module.css';
import styles from '../../app/leads/page.module.css';
import workspaceStyles from '../WorkspacePrimitives.module.css';

type Props = {
  open: boolean;
  workspace?: boolean;
  removing?: boolean;
  onRemove?: () => void;
  onTracking?: () => void;
  onToggle: () => void;
};

export default function SharedAssetControls({open, workspace, removing, onRemove, onTracking, onToggle}: Props) {
  return (
    <>
      {open && onRemove ? (
        <button
          type="button" data-tooltip="Remove from Shared Assets"
          className={`${assetStyles.controlTooltip} ${styles.leadControlTooltip} ${assetStyles.secondaryButton} ${workspace ? `${workspaceStyles.actionButton} ${workspaceStyles.actionDanger}` : ''} ${styles.deleteLeadButton}`}
          onClick={onRemove}
          disabled={removing}
        >
          Remove
        </button>
      ) : null}
      {onTracking ? (
        <button
          type="button" data-tooltip="Open tracking"
          className={`${assetStyles.controlTooltip} ${styles.leadControlTooltip} ${assetStyles.secondaryButton} ${workspace ? `${workspaceStyles.actionButton} ${workspaceStyles.actionNeutral}` : ''} ${styles.trackingOpenButton}`}
          onClick={onTracking}
        >
          Tracking
        </button>
      ) : null}
      <button
        type="button" data-tooltip={open ? 'Close lead' : 'Open lead'}
        className={`${assetStyles.controlTooltip} ${styles.leadControlTooltip} ${open ? assetStyles.secondaryButton : assetStyles.primaryButton} ${workspace ? `${workspaceStyles.actionButton} ${open ? workspaceStyles.actionNeutral : workspaceStyles.actionGreen}` : ''} ${open ? styles.trackingCloseButton : styles.openLeadButton}`}
        onClick={onToggle}
      >
        {open ? 'Close' : 'Open'}
      </button>
    </>
  );
}
