'use client';
import { useState } from 'react';
import AssetAccessSettingsDialog from './AssetAccessSettingsDialog';
import { DealerMaintenancePermissionPicker } from '../DealerMaintenanceAccessSettings';
import { normalizeExternalPermissions, readOnlyAssetLinkPermissions, type ExternalSharePermissions } from '../../lib/external-share-permissions';
import assetStyles from '../../app/asset-register/page.module.css';
import styles from './ShareLinkSettings.module.css';

export default function ShareLinkSettings({token, subject, initialPermissions, initialProtected=false, onClose, onSaved}: {
  token:string; subject:string; initialPermissions:ExternalSharePermissions; initialProtected?:boolean;
  onClose:()=>void; onSaved:(permissions:ExternalSharePermissions,protectedLink:boolean)=>void;
}) {
  const [permissions,setPermissions]=useState(()=>normalizeExternalPermissions(initialPermissions));
  const [protectedLink,setProtectedLink]=useState(initialProtected);
  const [changePassword,setChangePassword]=useState(false);
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function save() {
    setBusy(true); setError('');
    try {
      const response=await fetch('/api/asset-share-links/history', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,permissions,...(changePassword?{password}:{})})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || 'Unable to update access. Please try again.');
      setProtectedLink(data.protected===true);
      onSaved(data.permissions,data.protected===true);
    } catch(cause) { setError(cause instanceof Error ? cause.message : 'Unable to update access. Please try again.'); }
    finally { setBusy(false); }
  }
  return <AssetAccessSettingsDialog title="Asset link settings" assetTitle={subject} linkSettings onViewOnly={permissions.documents ? undefined : ()=>setPermissions({...readOnlyAssetLinkPermissions(permissions), reports:permissions.reports, allReports:permissions.allReports, documents:permissions.documents, directUpdates:permissions.directUpdates})} onClose={()=>{if(!busy) onClose();}} footer={<div data-access-actions className={`${assetStyles.formActions} ${assetStyles.exportActions} ${assetStyles.quoteTrackingSettingsActions}`}>
      <button type="button" className={assetStyles.secondaryButton} disabled={busy} onClick={onClose}>Cancel</button>
      <button type="button" className={assetStyles.primaryButton} disabled={busy||changePassword&&!!password&&password.length<8} onClick={()=>void save()}>{busy ? 'Saving…' : 'Save changes'}</button>
    </div>}>
          <section className={styles.passwordSettings} aria-label="Link password settings">
            <div><strong>Password protection</strong><p>{protectedLink?'Recipients need the current password to open this link.':'Anyone with the link can open it after signing in.'}</p></div>
            <label><input type="checkbox" checked={changePassword} disabled={busy} onChange={event=>{setChangePassword(event.target.checked);setPassword('');}}/><span>{protectedLink?'Change or remove password':'Add a password'}</span></label>
            {changePassword&&<div className={styles.passwordEntry}><label htmlFor="asset-share-history-password">{protectedLink?'New link password':'Link password'}</label><div><input id="asset-share-history-password" type={showPassword?'text':'password'} autoComplete="new-password" maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} placeholder={protectedLink?'Leave blank to remove protection':'At least 8 characters'}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div><small>{password&&password.length<8?'Use at least 8 characters.':'Passwords are case-sensitive. Send the password separately.'}</small></div>}
          </section>
          <DealerMaintenancePermissionPicker
            marketPrice={{enabled:permissions.marketPrice===true,onChange:enabled=>setPermissions(current=>({...current,marketPrice:enabled}))}}
            value={{canViewHistory:permissions.history===true,canSuggestCurrentValue:permissions.suggestValue===true,canUpdateDetails:permissions.updateDetails===true,canAccessLocation:permissions.location===true,canUpdateYear:permissions.yearModel===true,canUpdateUsage:permissions.usage===true,canUpdateCondition:permissions.condition===true,canAddMaintenance:permissions.addMaintenance===true,canViewParts:permissions.viewParts===true,canAddParts:permissions.addParts===true,canAddPhotos:permissions.addPhotos===true,canAddCosts:permissions.addCosts===true,canViewLoggedProblems:permissions.loggedProblems===true,canViewMaintenanceReports:permissions.maintenanceReports===true,canViewCostOfOwnership:permissions.costOfOwnership===true,canCreateMaintenanceSchedules:permissions.maintenanceSchedules===true,canUpdateSerial:permissions.serialNumber,canUpdateReplacementPrice:permissions.replacementPrice}}
            disabled={busy}
            onChange={(value,marketPriceEnabled)=>{setPermissions({...permissions,...normalizeExternalPermissions({...permissions,history:value.canViewHistory,suggestValue:value.canSuggestCurrentValue,marketPrice:marketPriceEnabled ?? permissions.marketPrice,updateDetails:value.canUpdateDetails,location:value.canAccessLocation,yearModel:value.canUpdateYear,usage:value.canUpdateUsage,condition:value.canUpdateCondition,addMaintenance:value.canAddMaintenance,viewParts:value.canViewParts,addParts:value.canAddParts,addPhotos:value.canAddPhotos,addCosts:value.canAddCosts,loggedProblems:value.canViewLoggedProblems,maintenanceReports:value.canViewMaintenanceReports,costOfOwnership:value.canViewCostOfOwnership,maintenanceSchedules:value.canCreateMaintenanceSchedules,serialNumber:value.canUpdateSerial,replacementPrice:value.canUpdateReplacementPrice})});}}
          />
    {error && <p role="alert">{error}</p>}

  </AssetAccessSettingsDialog>;
}
