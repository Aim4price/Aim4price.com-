'use client';
import { useId, useState } from 'react';
import PartsBusinessPicker from './PartsBusinessPicker';
import ShareDisclosureDialog from './asset-register/ShareDisclosureDialog';
import styles from './PartsShareFlow.module.css';
import AssetAccessSettingsDialog from './asset-register/AssetAccessSettingsDialog';
import ShareLinkPasswordStep, { type LinkPasswordChoice } from './asset-register/ShareLinkPasswordStep';
import layout from './asset-register/AssetAccessSettingsDialog.module.css';
import ShareDisclaimer from './asset-register/ShareDisclaimer';
import ShareLinkDelivery from './asset-register/ShareLinkDelivery';
import ownerStyles from './business-network/BusinessListingInvite.module.css';
import historyStyles from './asset-register/ShareHistory.module.css';
import destinationStyles from './asset-register/ShareDestinationDialog.module.css';
import choiceStyles from './asset-register/InsideShareDialog.module.css';
import assetStyles from '../app/asset-register/page.module.css';
type LinkItem={id:string;url:string;recipient_name:string;recipient_id:string|null;created_at:string;revoked_at:string|null;protected:boolean;allow_download:boolean;allow_enquiry:boolean};
type Recipient={email:string;business_name:string;town_city:string};
type Api=(body?:Record<string,unknown>,query?:string)=>Promise<any>;
export default function PartsShareFlow({name,count,network,api,onClose}:{name:string;count:number;network:string;api:Api;onClose:()=>void}) {
 const titleId=useId();
 const [passwordChoice,setPasswordChoice]=useState<LinkPasswordChoice|null>('none');
 const [startWithGuide,setStartWithGuide]=useState(true);
 const [step,setStep]=useState('choose'),[channel,setChannel]=useState('link'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [email,setEmail]=useState(''),[recipients,setRecipients]=useState<Recipient[]>([]);
 const [download,setDownload]=useState(false),[enquiry,setEnquiry]=useState(false),[password,setPassword]=useState(''),[accepted,setAccepted]=useState(false),[url,setUrl]=useState('');
 const [links,setLinks]=useState<LinkItem[]>([]),[selected,setSelected]=useState<LinkItem|null>(null),[page,setPage]=useState(0),[confirm,setConfirm]=useState<'revoke-share'|'delete-share'|null>(null);

 async function run(fn:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 async function history(){const data=await api({action:'share-history',network});setLinks(data.links||[]);setPage(0);setStep('history');setSelected(null);setConfirm(null);}
 const editing = step==='settings' || step==='settings-password';
 const actionsClass = `${assetStyles.formActions} ${assetStyles.exportActions} ${assetStyles.quoteTrackingSettingsActions}`;
 function chooseAccess(viewOnly=false) {
   if(viewOnly) { setDownload(false); setEnquiry(false); }
   setStartWithGuide(false);
   setAccepted(false);
   setStep(editing?'settings-password':'password');
 }
 async function saveSettings() {
   await api({action:'update-share',network,id:selected?.id,allowDownload:download,allowEnquiry:enquiry,
     ...(passwordChoice==='set'?{password}:passwordChoice==='remove'?{password:''}:{})});
   await history();
 }
 const footer=<footer className={ownerStyles.footer}>
   <button type="button" className={ownerStyles.copy} disabled={busy} onClick={()=>{setError('');setStep('password');}}>Back</button>
   <button type="button" className={ownerStyles.primary} disabled={!accepted||busy} onClick={()=>void run(async()=>{
     const data=await api({action:'create-share',network,channel,email,allowDownload:download,allowEnquiry:enquiry,password:passwordChoice==='set'?password:'',accepted});
     setUrl(data.url);setStep('send');
   })}>Create parts link</button>
 </footer>;
 const editLink=(link:LinkItem)=>{setSelected(link);setChannel(link.recipient_id?'direct':'link');setDownload(link.allow_download);setEnquiry(link.allow_enquiry);setPassword('');setPasswordChoice(null);setStartWithGuide(true);setConfirm(null);setError('');setStep('settings');};
 const linkIcon=<svg className={historyStyles.linkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2"/></svg>;
 if(step==='choose') return <AssetAccessSettingsDialog subjectHeader title={name} assetTitle={`${count} ${count===1?'part':'parts'} · Choose how to share`} onClose={onClose}>
  <div className={choiceStyles.destinationBody}><div className={`${choiceStyles.grid} ${choiceStyles.pickerGrid}`}>
   <button type="button" className={choiceStyles.card} data-tone="link" disabled={busy} onClick={()=>{setChannel('link');setStep('permissions');setPassword('');setPasswordChoice('none');setStartWithGuide(true);setDownload(false);setEnquiry(false);setAccepted(false);}}><span className={choiceStyles.icon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2"/></svg></span><span className={choiceStyles.copy}><strong>Share link</strong><small>Share your parts list with anyone</small></span></button>
   <button type="button" className={choiceStyles.card} disabled={busy} onClick={()=>{setChannel('direct');setStep('recipient');setPassword('');setPasswordChoice('none');setStartWithGuide(true);setDownload(false);setEnquiry(false);setAccepted(false);}}><span className={choiceStyles.icon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 21V7l9-4 9 4v14M1 21h22M7 21V11h10v10M8 7h8"/></svg></span><span className={choiceStyles.copy}><strong>Inside Aim4price</strong><small>Choose an approved directory business</small></span></button>
  </div><div className={destinationStyles.historyActions}><button aria-label="Sharing history" type="button" disabled={busy} onClick={()=>void run(history)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2"/></svg><span>Sharing history</span><span className={destinationStyles.historyHint}>Manage shared links</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></div></div>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
 </AssetAccessSettingsDialog>;
 if(step==='history') return <AssetAccessSettingsDialog title="Sharing history" assetTitle={name} onClose={onClose}>
  <div className={`${historyStyles.panel} ${styles.historyPanel}`} data-share-history><p className={historyStyles.intro}>Manage your shared links and access.</p>
   {error?<p role="alert" className={historyStyles.error}>{error}</p>:null}
   {!links.length?<p className={historyStyles.empty}>No shared links yet.</p>:<div className={`${historyStyles.list} ${styles.historyList}`} aria-busy={busy}>{(confirm&&selected?[selected]:links.slice(page*4,page*4+4)).map(link=><article className={historyStyles.row} key={link.id}>{linkIcon}<div className={historyStyles.details}><strong>{link.recipient_name||'Shared link'}</strong><small>{new Date(link.created_at).toLocaleString('en-ZA',{dateStyle:'medium',timeStyle:'short'})}{link.protected?' · Password protected':''}</small></div><span className={historyStyles.status} data-revoked={!!link.revoked_at}>{link.revoked_at?'Access revoked':'Active'}</span>{!confirm?<div className={historyStyles.actions}>{link.revoked_at?<button className={historyStyles.revoke} disabled={busy} onClick={()=>{setSelected(link);setConfirm('delete-share');}}>Delete</button>:<><a href={link.url} target="_blank" rel="noreferrer">Open</a><button disabled={busy} onClick={()=>editLink(link)}>Settings</button><button className={historyStyles.revoke} disabled={busy} onClick={()=>{setSelected(link);setConfirm('revoke-share');}}>Revoke access</button></>}</div>:null}</article>)}</div>}
   {confirm&&selected?<div className={`${styles.notice} ${styles.linkConfirmation}`} role="group" aria-label="Confirm link change"><strong>{confirm==='delete-share'?'Delete this link from history?':'Revoke access to this link?'}</strong><p>The link will stop working for everyone.</p><div className={historyStyles.actions}><button disabled={busy} onClick={()=>{setConfirm(null);setSelected(null);}}>Keep link</button><button className={historyStyles.revoke} disabled={busy} onClick={()=>void run(async()=>{await api({action:confirm,network,id:selected.id});await history();})}>Confirm {confirm==='delete-share'?'delete':'revoke'}</button></div></div>:null}
   {!confirm?<footer><button className={historyStyles.backButton} disabled={busy} onClick={()=>{setConfirm(null);setSelected(null);setStep('choose');}}>Share options</button><span className={historyStyles.page}>Page {page+1}</span>{page>0?<button disabled={busy} onClick={()=>setPage(page-1)}>Previous links</button>:null}{(page+1)*4<links.length?<button disabled={busy} onClick={()=>setPage(page+1)}>Next links</button>:null}</footer>:null}
  </div>
 </AssetAccessSettingsDialog>;
 if(step==='settings'||step==='permissions') return <AssetAccessSettingsDialog key={step} title="Parts link settings" assetTitle={name} onClose={onClose}
   guideLayout linkSettings={startWithGuide} onViewOnly={()=>chooseAccess(true)}
   guideDescription={channel==='direct'?'Only your chosen business can view the list.':'Anyone with the link can view the list.'}
   permissionsDescription="Choose downloads and enquiries."
   footer={<div data-access-actions className={actionsClass}>
     <button type="button" className={assetStyles.secondaryButton} disabled={busy} onClick={()=>step==='settings'?void run(history):setStep(channel==='direct'?'recipient':'choose')}>Back</button>
     <button type="button" className={assetStyles.primaryButton} disabled={busy} onClick={()=>chooseAccess()}>Continue</button>
   </div>}>
   <div className={layout.guideBody} data-parts-permissions>
     <p className={layout.guideHeading} id={titleId}>Recipient permissions</p>
     <p className={layout.guideDescription}>Sign-in required for both options.</p>
     <div className={layout.accessChoices} role="group" aria-labelledby={titleId}>
       <label className={`${layout.accessChoice} ${layout.permissionsChoice}`}>
         <input className={styles.permissionCheck} type="checkbox" aria-label="Download parts" checked={download} onChange={e=>{setDownload(e.target.checked);setAccepted(false);}}/>
         <strong className={layout.choiceTitle}>Download parts</strong>
         <span className={layout.choiceDescription}>Save the parts PDF.</span>
       </label>
       <label className={`${layout.accessChoice} ${layout.viewChoice}`}>
         <input className={styles.permissionCheck} type="checkbox" aria-label="Send enquiries" checked={enquiry} onChange={e=>{setEnquiry(e.target.checked);setAccepted(false);}}/>
         <strong className={layout.choiceTitle}>Send enquiries</strong>
         <span className={layout.choiceDescription}>Ask about listed parts.</span>
       </label>
     </div>
   </div>
   {error && <p role="alert" className={styles.error}>{error}</p>}
 </AssetAccessSettingsDialog>;
 if(step==='password'||step==='settings-password') return <AssetAccessSettingsDialog key={step} title="Protect your parts link" assetTitle={name} guideLayout onClose={onClose}
   focusSelector="[data-link-password-choices] button"
   footer={<div data-access-actions className={actionsClass}>
     <button type="button" className={assetStyles.secondaryButton} disabled={busy} onClick={()=>{setError('');setStep(editing?'settings':'permissions');}}>Back</button>
     <button type="button" className={assetStyles.primaryButton} disabled={busy||!passwordChoice||(passwordChoice==='set'&&password.length<8)} onClick={()=>editing?void run(saveSettings):setStep('risk')}>{editing?'Save settings':'Continue'}</button>
   </div>}>
   <ShareLinkPasswordStep choice={passwordChoice} password={password} disabled={busy} protectedLink={editing && selected?.protected}
     partsAudience={channel==='direct'?'business':'public'}
     onChoiceChange={choice=>{setPasswordChoice(choice);if(choice!=='set')setPassword('');setAccepted(false);}}
     onPasswordChange={value=>{setPassword(value);setAccepted(false);}}/>
   {error && <p role="alert" className={styles.error}>{error}</p>}
 </AssetAccessSettingsDialog>;
 if(step==='risk') return <ShareDisclosureDialog title="Before you share" titleId={titleId} closeLabel="Close dialog" onClose={onClose} className={ownerStyles.inviteDialog}>
   <form className={ownerStyles.form} onSubmit={e=>e.preventDefault()}><fieldset disabled={busy}>
   <ShareDisclaimer accepted={accepted} onChange={setAccepted} disabled={busy} disclosure={`${channel==='link'?'Anyone with this link':recipients.find(r=>r.email===email)?.business_name||email} can view the shared parts${password?' after entering the password':''}. ${download?'Downloads are allowed. ':''}${enquiry?'Enquiries are allowed. ':''}Downloads and enquiries require an Aim4price account. Links can be forwarded. Private fields stay private.`}/>
   {footer}
   </fieldset></form>{error?<p role="alert">{error}</p>:null}
 </ShareDisclosureDialog>;
 if(step==='send') return <ShareDisclosureDialog title="Send link" titleId={titleId} closeLabel="Close dialog" onClose={onClose} className={ownerStyles.inviteDialog}>
   <ShareLinkDelivery link={url} copy={{subject:name,body:`Parts shared with you: ${url}`}} description="The selected parts list will be shared with the same permissions." previewLabel="Preview parts"
   hint={`Choose the recipient in WhatsApp or your email app. ${channel==='direct'?'Only the selected business account can open this link.':'Anyone with this link can view the shared parts.'} Downloads and enquiries require an Aim4price account and the permissions you selected. ${password?'Send the password separately. ':''}You can revoke the link in History.`}/>
 </ShareDisclosureDialog>;
 return <PartsBusinessPicker name={name} count={count} network={network} api={api} selected={email} onSelect={business=>{setEmail(business?.email||'');setRecipients(business?[business]:[]);setAccepted(false);}} onContinue={()=>setStep('permissions')} onClose={()=>setStep('choose')}/>;
}
