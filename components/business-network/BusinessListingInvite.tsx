'use client';
import { type ExternalShareFileSource } from '../../lib/external-file-share';
import AssetAccessSettingsDialog from '../asset-register/AssetAccessSettingsDialog';
import assetStyles from '../../app/asset-register/page.module.css';
import { DealerMaintenancePermissionPicker } from '../DealerMaintenanceAccessSettings';
import ShareDisclaimer from '../asset-register/ShareDisclaimer';
import ShareDisclosureDialog from '../asset-register/ShareDisclosureDialog';

import { useEffect, useId, useRef, useState } from 'react';
import ShareLinkDelivery from '../asset-register/ShareLinkDelivery';
import styles from './BusinessListingInvite.module.css';
import { assetLinkPermissions, readOnlyAssetLinkPermissions, type ExternalSharePermissions } from '../../lib/external-share-permissions';

export type BusinessListingInviteProps = { sendLink?: boolean; onDismiss?: () => void; senderName?: string; umbrellaId?: string; assetIds: string[]; includePhotos?: boolean; reportAssets?: {id:string;title:string}[]; reportUmbrellaName?: string; onChooseReport?: (assetId:string|null, onComplete:(source:ExternalShareFileSource|null)=>void)=>void };
export default function BusinessListingInvite({ sendLink = false, onDismiss, assetIds, umbrellaId, reportAssets = [], reportUmbrellaName, onChooseReport }: BusinessListingInviteProps) {
  const titleId = useId();
  const descriptionId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState<'permissions'|'recipient'>('permissions');
  const [permissions, setPermissions] = useState<ExternalSharePermissions>(assetLinkPermissions());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const opening = useRef(false);
  const [selection, setSelection] = useState<{assetIds: string[]; includePhotos: boolean; umbrellaId?: string} | null>(sendLink ? {assetIds: [...assetIds], includePhotos:true, umbrellaId} : null);
  const [accepted, setAccepted] = useState(false);
  const requestVersion = useRef(0);
  useEffect(() => () => { requestVersion.current++; }, []);
  const [senderName, setSenderName] = useState('');
  const [link, setLink] = useState('');
  const copy = {
    subject: sendLink ? 'Shared assets on Aim4price' : 'An invitation to the Aim4price business directory',
    body: `${senderName || 'We'} would like to share asset details and requests with you through Aim4price. Open the enquiry to view the selected assets.\n\nView the enquiry here:\n${link}`,
  };

  function open() {
    if (!assetIds.length) { setError('Select the assets you want to include in this enquiry.'); return; }
    setSelection({assetIds: [...assetIds], includePhotos:true, ...(umbrellaId ? { umbrellaId } : {})});
    setStep('permissions'); setPermissions(assetLinkPermissions());
    setAccepted(false); setLink(''); setError('');
  }

  function close() {
    if (busy) return;
    if (step === 'recipient' && !link) { setStep('permissions'); return; }
    requestVersion.current++;
    setSelection(null); setLink(''); setAccepted(false);
    opening.current = false; setBusy(false);
    trigger.current?.focus();
    onDismiss?.();
  }

  async function prepare() {
    if (!accepted || !selection) return;
    if (opening.current) return;
    const version = ++requestVersion.current;
    opening.current = true;
    setBusy(true); setError('');
    try {
      if (!selection.assetIds.length) throw new Error('Select the assets you want to include in this enquiry.');
      const url = new URL('/business-network/accept', window.location.origin);
      let response: Response;
      {
        const form = new FormData();
        form.set('assetIds', JSON.stringify(selection.assetIds));
        form.set('includePhotos', String(selection.includePhotos));
        if (selection.umbrellaId) form.set('umbrellaId', selection.umbrellaId);
        form.set('details', JSON.stringify({ accessMode: 'signed-in', recipientName: '', recipientEmail: '', request: 'Please open the shared assets.', replyPhone: '', allowReply: false, permissions }));
        response = await fetch('/api/asset-share-links/leads', { method: 'POST', body: form });
      }
      const data = await response.json();
      if (!response.ok || !data.share?.token) throw new Error(data.error || 'Unable to prepare the enquiry. Please try again.');
      url.searchParams.set('share', data.share.token);
      if (version === requestVersion.current) setSenderName(typeof data.share.sender_name === 'string' ? data.share.sender_name.trim().slice(0, 120) : '');
      if (version === requestVersion.current) setLink(sendLink ? new URL(`/asset-share/${data.share.token}`, window.location.origin).href : url.href);
    } catch (cause) {
      if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : 'Unable to prepare the enquiry. Please try again.');
    } finally { if (version === requestVersion.current) { opening.current = false; setBusy(false); } }
  }

  const Dialog = !link && step === 'permissions' ? AssetAccessSettingsDialog : ShareDisclosureDialog;
  return <>
    {!sendLink && <button ref={trigger} type="button" className={styles.trigger} aria-haspopup="dialog" disabled={busy} onClick={() => void open()}>
      <span>{busy ? 'Preparing enquiry…' : 'Business not listed?'}</span><span aria-hidden="true">+</span>
    </button>}
    {error && !selection && <p role="alert">{error}</p>}
    {selection && <Dialog linkSettings onViewOnly={()=>{setPermissions(readOnlyAssetLinkPermissions(permissions));setAccepted(false);setStep('recipient');}} assetTitle={reportUmbrellaName || (selection.assetIds.length===1 ? reportAssets.find(asset=>asset.id===selection.assetIds[0])?.title || 'Selected asset' : `${selection.assetIds.length} selected assets`)} className={styles.inviteDialog} title={link ? (sendLink ? "Send link" : "Invite a business") : step === 'permissions' ? "Asset link settings" : "Before you share"} titleId={titleId} descriptionId={step === 'permissions' || link ? descriptionId : undefined} closeLabel={sendLink ? "Back to share options" : "Close business invitation"} onClose={close} footer={!link && step === 'permissions' ? (<div data-access-actions className={`${assetStyles.formActions} ${assetStyles.exportActions} ${assetStyles.quoteTrackingSettingsActions}`}>
            <button type="button" className={assetStyles.secondaryButton} onClick={()=>{setPermissions(readOnlyAssetLinkPermissions(permissions));setStep('recipient');}}>Continue view only</button>
            <button type="button" className={assetStyles.primaryButton} onClick={()=>setStep('recipient')}>Continue</button>
          </div>) : undefined}>
        {!link && step === 'permissions' && <>
          <DealerMaintenancePermissionPicker
            marketPrice={{enabled:permissions.marketPrice===true,onChange:enabled=>setPermissions(current=>({...current,marketPrice:enabled}))}}
            value={{canUpdateDetails:permissions.updateDetails===true,canAccessLocation:permissions.location===true,canViewHistory:permissions.history===true,canSuggestCurrentValue:permissions.suggestValue===true,canUpdateYear:permissions.yearModel===true,canUpdateUsage:permissions.usage===true,canUpdateCondition:permissions.condition===true,canAddMaintenance:permissions.addMaintenance===true,canViewParts:permissions.viewParts===true,canAddParts:permissions.addParts===true,canAddPhotos:permissions.addPhotos===true,canAddCosts:permissions.addCosts===true,canViewLoggedProblems:permissions.loggedProblems===true,canViewMaintenanceReports:permissions.maintenanceReports===true,canViewCostOfOwnership:permissions.costOfOwnership===true,canCreateMaintenanceSchedules:permissions.maintenanceSchedules===true,canUpdateSerial:permissions.serialNumber,canUpdateReplacementPrice:permissions.replacementPrice}}
            onChange={(value,marketPriceEnabled)=>{setPermissions(assetLinkPermissions({updateDetails:value.canUpdateDetails,location:value.canAccessLocation,history:value.canViewHistory,suggestValue:value.canSuggestCurrentValue,marketPrice:marketPriceEnabled ?? permissions.marketPrice,yearModel:value.canUpdateYear,usage:value.canUpdateUsage,condition:value.canUpdateCondition,addMaintenance:value.canAddMaintenance,viewParts:value.canViewParts,addParts:value.canAddParts,addPhotos:value.canAddPhotos,addCosts:value.canAddCosts,loggedProblems:value.canViewLoggedProblems,maintenanceReports:value.canViewMaintenanceReports,costOfOwnership:value.canViewCostOfOwnership,maintenanceSchedules:value.canCreateMaintenanceSchedules,serialNumber:value.canUpdateSerial,replacementPrice:value.canUpdateReplacementPrice}));setAccepted(false);}}
          />

        </>}
        {!link && step === 'recipient' && <form className={styles.form} onSubmit={e=>{e.preventDefault();void prepare();}}>
          <fieldset disabled={busy}>
            <ShareDisclaimer accepted={accepted} onChange={setAccepted} disabled={busy} publicLink />
            <div className={styles.footer}><button type="button" className={styles.copy} onClick={()=>{setStep('permissions');setAccepted(false);}}>Back</button><button className={styles.primary} disabled={!accepted || busy}>{busy ? 'Preparing enquiry…' : sendLink ? 'Create asset link' : 'Create invitation link'}</button></div>
          </fieldset>
        </form>}


        {error && <p role="alert">{error}</p>}
        {link && <>
        <ShareLinkDelivery linkLabel={sendLink?"Asset link":"Business invitation link"} copiedMessage={sendLink?"Asset link copied.":"Invitation link copied."} descriptionId={descriptionId} link={link} copy={copy} description={`${selection.assetIds.length === 1 ? 'The selected asset' : `All ${selection.assetIds.length} selected assets`} will be shared with the same permissions.`} hint="Choose the recipient in WhatsApp or your email app. Anyone with this link can sign in to view the assets and use the permissions you selected. New free accounts verify their email once. You can revoke the link in History." previewLabel="Preview enquiry" />
        </>}
      </Dialog>}
  </>;
}
