'use client';
import { useState } from 'react';
import AssetAccessSettingsDialog from './AssetAccessSettingsDialog';
import { DealerMaintenancePermissionPicker } from '../DealerMaintenanceAccessSettings';
import { normalizeExternalPermissions, type ExternalSharePermissions } from '../../lib/external-share-permissions';
import assetStyles from '../../app/asset-register/page.module.css';

export default function ShareLinkSettings({token, subject, initialPermissions, onClose, onSaved}: {
  token:string; subject:string; initialPermissions:ExternalSharePermissions;
  onClose:()=>void; onSaved:(permissions:ExternalSharePermissions)=>void;
}) {
  const [permissions,setPermissions]=useState(()=>normalizeExternalPermissions(initialPermissions));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function save() {
    setBusy(true); setError('');
    try {
      const response=await fetch('/api/asset-share-links/history', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,permissions})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || 'Unable to update access. Please try again.');
      onSaved(data.permissions);
    } catch(cause) { setError(cause instanceof Error ? cause.message : 'Unable to update access. Please try again.'); }
    finally { setBusy(false); }
  }
  return <AssetAccessSettingsDialog title="Asset link settings" assetTitle={subject} linkSettings onClose={()=>{if(!busy) onClose();}}>
    <div className={assetStyles.dealerTrackingIntro}><strong>Choose what recipients can access</strong><p>Changes apply to everyone using this shared link.</p></div>
          <DealerMaintenancePermissionPicker
            value={{canUpdateDetails:permissions.updateDetails===true,canAccessLocation:permissions.location===true,canUpdateYear:permissions.yearModel===true,canUpdateUsage:permissions.usage===true,canUpdateCondition:permissions.condition===true,canAddMaintenance:permissions.addMaintenance===true,canAddPhotos:permissions.addPhotos===true,canAddCosts:permissions.addCosts===true,canViewLoggedProblems:permissions.loggedProblems===true,canViewMaintenanceReports:permissions.maintenanceReports===true,canViewCostOfOwnership:permissions.costOfOwnership===true,canCreateMaintenanceSchedules:permissions.maintenanceSchedules===true,canUpdateSerial:permissions.serialNumber,canUpdateReplacementPrice:permissions.replacementPrice}}
            disabled={busy}
            onChange={value=>{setPermissions({...permissions,...normalizeExternalPermissions({...permissions,updateDetails:value.canUpdateDetails,location:value.canAccessLocation,yearModel:value.canUpdateYear,usage:value.canUpdateUsage,condition:value.canUpdateCondition,addMaintenance:value.canAddMaintenance,addPhotos:value.canAddPhotos,addCosts:value.canAddCosts,loggedProblems:value.canViewLoggedProblems,maintenanceReports:value.canViewMaintenanceReports,costOfOwnership:value.canViewCostOfOwnership,maintenanceSchedules:value.canCreateMaintenanceSchedules,serialNumber:value.canUpdateSerial,replacementPrice:value.canUpdateReplacementPrice})});}}
          />
    {error && <p role="alert">{error}</p>}
    <div className={`${assetStyles.formActions} ${assetStyles.exportActions} ${assetStyles.quoteTrackingSettingsActions}`}>
      <button type="button" className={assetStyles.secondaryButton} disabled={busy} onClick={onClose}>Cancel</button>
      <button type="button" className={assetStyles.primaryButton} disabled={busy} onClick={()=>void save()}>{busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  </AssetAccessSettingsDialog>;
}
