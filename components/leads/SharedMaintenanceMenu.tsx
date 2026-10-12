'use client';

import LeadManageDialog from './LeadManageDialog';
import AssetActionIcon from '../asset-register/AssetActionIcon';
import assetStyles from '../../app/asset-register/page.module.css';
import accountStyles from '../../app/account/page.module.css';
import actionStyles from './ManageActionGrid.module.css';

/** Same owner menu geometry, with actions limited to the recipient's permissions. */
export default function SharedMaintenanceMenu({ title, description, suspended, onClose, onRecord, onParts, onSchedule }: {
  title: string; description: string; suspended?: boolean; onClose: () => void;
  onRecord?: () => void; onParts?: () => void; onSchedule?: () => void;
}) {
  return <LeadManageDialog title={title} description={description} suspended={suspended} onClose={onClose} ownerLayout classes={{
    modal: `${assetStyles.maintenanceMenuModal} ${assetStyles.managementAccountModal} ${accountStyles.modalTheme}`,
    header: assetStyles.ownerCommandChoiceHeader,
  }}>
    <div className={`${assetStyles.optionsGrid} ${assetStyles.assetOptionsGrid} ${assetStyles.ownerCommandGrid} ${assetStyles.maintenanceMenuGrid} ${actionStyles.grid} ${actionStyles.pricingMaintenance}`} data-manage-actions>
      {onRecord && <button type="button" data-manage-action="addMaintenance" className={`${assetStyles.optionActionButton} ${assetStyles.ownerCommandAction}`} onClick={onRecord}><svg className={assetStyles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 4v16M4 12h16" /></svg><span><strong>Add maintenance</strong><small>Record completed checks, services or repairs.</small></span></button>}
      {onParts && <button type="button" data-manage-action="viewParts" className={`${assetStyles.optionActionButton} ${assetStyles.ownerCommandAction}`} onClick={onParts}><AssetActionIcon action="viewParts" className={assetStyles.buttonIcon} /><span><strong>Parts</strong><small>View and manage parts for this asset.</small></span></button>}
      {onSchedule && <button type="button" data-manage-action="maintenanceSchedules" className={`${assetStyles.optionActionButton} ${assetStyles.ownerCommandAction}`} onClick={onSchedule}><AssetActionIcon action="maintenanceSchedules" className={assetStyles.buttonIcon} /><span><strong>Schedule maintenance</strong><small>Create and manage scheduled work.</small></span></button>}
    </div>
  </LeadManageDialog>;
}
