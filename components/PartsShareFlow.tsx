'use client';
import { useEffect, useId, useState } from 'react';
import PartsBusinessPicker from './PartsBusinessPicker';
import ShareDisclosureDialog from './asset-register/ShareDisclosureDialog';
import styles from './PartsShareFlow.module.css';
import AssetAccessSettingsDialog from './asset-register/AssetAccessSettingsDialog';
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
 const passwordId=useId();
 const [showPassword,setShowPassword]=useState(false),[protectLink,setProtectLink]=useState(false);
 const [step,setStep]=useState('choose'),[channel,setChannel]=useState('link'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [email,setEmail]=useState(''),[recipients,setRecipients]=useState<Recipient[]>([]);
 const [download,setDownload]=useState(false),[enquiry,setEnquiry]=useState(false),[password,setPassword]=useState(''),[replacePassword,setReplacePassword]=useState(false),[accepted,setAccepted]=useState(false),[url,setUrl]=useState('');
 const [links,setLinks]=useState<LinkItem[]>([]),[selected,setSelected]=useState<LinkItem|null>(null),[page,setPage]=useState(0),[confirm,setConfirm]=useState<'revoke-share'|'delete-share'|null>(null);
 useEffect(()=>setShowPassword(false),[step]);
 async function run(fn:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 async function history(){const data=await api({action:'share-history',network});setLinks(data.links||[]);setPage(0);setStep('history');setSelected(null);setConfirm(null);}
 const titles:Record<string,string>={choose:name,recipient:'Choose a business',permissions:'Parts link settings',risk:'Before you share',send:'Send link',history:'Sharing history',settings:'Link settings'};
 const permissionIcon=(kind:'view'|'download'|'enquiry'|'lock')=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='view'?<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>:kind==='download'?<><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/></>:kind==='enquiry'?<><path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8M8 12h5"/></>:<><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>}</svg>;
 const permissions=<>
  <p className={styles.lead}>Choose what recipients can do.</p>
  <div className={styles.viewAccess}><span className={styles.permissionIcon}>{permissionIcon('view')}</span><div><strong>View parts</strong><small>{channel==='link'?'Anyone with your link can view the list.':'Only your chosen business can view the list.'}</small></div><span className={styles.included}>Always included</span></div>
  <div className={styles.permissionOptions}>
   <label className={`${styles.permissionOption} ${styles.downloadCard}`}><span className={styles.permissionIcon}>{permissionIcon('download')}</span><span className={styles.permissionCopy}><strong>Download parts</strong><small>Save your branded parts PDF.</small></span><span className={styles.permissionToggle}><input aria-label="Download parts" type="checkbox" checked={download} onChange={e=>{setDownload(e.target.checked);setAccepted(false);}}/><small>{download?'Allowed':'Not allowed'}</small></span></label>
   <label className={`${styles.permissionOption} ${styles.enquiryCard}`}><span className={styles.permissionIcon}>{permissionIcon('enquiry')}</span><span className={styles.permissionCopy}><strong>Send enquiries</strong><small>Ask you about parts and quantities.</small></span><span className={styles.permissionToggle}><input aria-label="Send enquiries" type="checkbox" checked={enquiry} onChange={e=>{setEnquiry(e.target.checked);setAccepted(false);}}/><small>{enquiry?'Allowed':'Not allowed'}</small></span></label>
  </div>
  <p className={styles.accessNote}>{permissionIcon('lock')}<span>Recipients sign in to download or enquire. Editing and sharing stay with you.</span></p>
 </>;
 const isOwnerStep=['permissions','settings','risk','send'].includes(step);
 const footer=(
  <footer data-access-actions={step==='settings'||undefined} className={step==='settings'?assetStyles.formActions:isOwnerStep?ownerStyles.footer:styles.footer}>
   <button className={isOwnerStep?ownerStyles.copy:undefined} disabled={busy} onClick={()=>{setError('');setNotice('');if(step==='choose')onClose();else if(step==='settings')void run(history);else setStep(step==='risk'?'password':step==='permissions'&&channel==='direct'?'recipient':'choose');}}>{step==='choose'?'Cancel':step==='history'?'Share options':'Back'}</button>
   {step==='recipient'?<button className={isOwnerStep?ownerStyles.primary:styles.primary} disabled={!email||busy} onClick={()=>setStep('permissions')}>Continue</button>:null}
   {step==='permissions'?<button className={isOwnerStep?ownerStyles.primary:styles.primary} disabled={busy||!!password&&password.length<8} onClick={()=>setStep('risk')}>Continue</button>:null}
   {step==='risk'?<button className={isOwnerStep?ownerStyles.primary:styles.primary} disabled={!accepted||busy} onClick={()=>void run(async()=>{const data=await api({action:'create-share',network,channel,email,allowDownload:download,allowEnquiry:enquiry,password:protectLink?password:'',accepted});setUrl(data.url);setStep('send');})}>Create parts link</button>:null}
   {step==='settings'&&!confirm?<button className={isOwnerStep?ownerStyles.primary:styles.primary} disabled={busy||!!selected?.revoked_at||replacePassword&&!!password&&password.length<8} onClick={()=>void run(async()=>{await api({action:'update-share',network,id:selected?.id,allowDownload:download,allowEnquiry:enquiry,...(replacePassword?{password}:{})});await history();})}>Save settings</button>:null}
   {step==='send'||step==='history'?<button className={isOwnerStep?ownerStyles.primary:styles.primary} onClick={onClose}>Done</button>:null}
  </footer>);
 const passwordSettings=(<div className={styles.settingsContent}>
    {step==='settings-password'?<label className={styles.check}><input type="checkbox" checked={replacePassword} onChange={e=>setReplacePassword(e.target.checked)}/>Change or remove the password</label>:null}
    {(step==='password'&&protectLink||step==='settings-password'&&replacePassword)?<div className={styles.passwordPanel}><div className={styles.passwordHeading}><span className={styles.permissionIcon}>{permissionIcon('lock')}</span><div><label htmlFor={passwordId}>Link password <span>(optional)</span></label><p>Send the password separately.</p></div></div><div className={styles.passwordControl}><div className={styles.password}><input id={passwordId} type={showPassword?"text":"password"} autoComplete="new-password" maxLength={128} value={password} onChange={e=>{setPassword(e.target.value);setAccepted(false);}} placeholder="At least 8 characters"/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-controls={passwordId} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPassword?<path d="m3 3 18 18"/>:null}</svg></button></div><small>{step==='settings-password'?'Leave blank to remove protection.':password?(password.length<8?'Use at least 8 characters.':'Password protection is enabled.'):'Use at least 8 characters, then send the password separately.'}</small></div></div>:null}
</div>
);
 const editLink=(link:LinkItem)=>{setSelected(link);setChannel(link.recipient_id?'direct':'link');setDownload(link.allow_download);setEnquiry(link.allow_enquiry);setPassword('');setShowPassword(false);setReplacePassword(false);setConfirm(null);setError('');setStep('settings');};
 const linkIcon=<svg className={historyStyles.linkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2"/></svg>;
 if(step==='choose') return <AssetAccessSettingsDialog subjectHeader title={name} assetTitle={`${count} ${count===1?'part':'parts'} · Choose how to share`} onClose={onClose}>
  <div className={choiceStyles.destinationBody}><div className={`${choiceStyles.grid} ${choiceStyles.pickerGrid}`}>
   <button type="button" className={choiceStyles.card} data-tone="link" disabled={busy} onClick={()=>{setChannel('link');setStep('permissions');setPassword('');setProtectLink(false);setAccepted(false);}}><span className={choiceStyles.icon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2"/></svg></span><span className={choiceStyles.copy}><strong>Share link</strong><small>Share your parts list with anyone</small></span></button>
   <button type="button" className={choiceStyles.card} disabled={busy} onClick={()=>{setChannel('direct');setStep('recipient');setPassword('');setProtectLink(false);setAccepted(false);}}><span className={choiceStyles.icon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 21V7l9-4 9 4v14M1 21h22M7 21V11h10v10M8 7h8"/></svg></span><span className={choiceStyles.copy}><strong>Inside Aim4price</strong><small>Choose an approved directory business</small></span></button>
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
 if(step==='settings'||step==='permissions') return <AssetAccessSettingsDialog key={step} title="Parts link settings" assetTitle={name} compactLayout onClose={onClose}
  footer={<div data-access-actions className={assetStyles.formActions}><button type="button" className={assetStyles.secondaryButton} onClick={()=>step==='settings'?void run(history):setStep(channel==='direct'?'recipient':'choose')}>Back</button><button type="button" className={assetStyles.primaryButton} disabled={busy} onClick={()=>setStep(step==='settings'?'settings-password':'password')}>Continue</button></div>}>
  <div className={styles.settingsContent}>{permissions}</div>
 </AssetAccessSettingsDialog>;
 if(step==='password'||step==='settings-password') return <AssetAccessSettingsDialog key={step} title="Protect your parts link" assetTitle={name} compactLayout onClose={onClose}
  footer={<div data-access-actions className={assetStyles.formActions}><button type="button" className={assetStyles.secondaryButton} disabled={busy} onClick={()=>setStep(step==='settings-password'?'settings':'permissions')}>Back</button><button type="button" className={assetStyles.primaryButton} disabled={busy||(step==='password'?protectLink&&password.length<8:replacePassword&&!!password&&password.length<8)} onClick={()=>step==='password'?setStep('risk'):void run(async()=>{await api({action:'update-share',network,id:selected?.id,allowDownload:download,allowEnquiry:enquiry,...(replacePassword?{password}:{})});await history();})}>{step==='settings-password'?'Save settings':'Continue'}</button></div>}>
  <div className={styles.passwordSlide}>
   {step==='password'?<><p className={styles.lead}>Would you like to add a password?</p><div className={styles.passwordChoices} role="group" aria-label="Password protection">
    <button type="button" aria-pressed={!protectLink} onClick={()=>{setProtectLink(false);setPassword('');setAccepted(false);}}><span className={styles.permissionIcon}>{permissionIcon('view')}</span><span><strong>No password</strong><small>{channel==='direct'?'Your chosen business can open the link after signing in.':'Anyone with your link can open the parts list.'}</small></span></button>
    <button type="button" aria-pressed={protectLink} onClick={()=>{setProtectLink(true);setAccepted(false);}}><span className={styles.permissionIcon}>{permissionIcon('lock')}</span><span><strong>Add a password</strong><small>Recipients enter your password before viewing parts.</small></span></button>
   </div></>:<div className={styles.passwordSummary}><span className={styles.permissionIcon}>{permissionIcon('lock')}</span><div><strong>{selected?.protected?'This link is password protected':'This link has no password'}</strong><p>Keep the current protection, or change it below.</p></div></div>}
   {passwordSettings}
   {step==='password'&&!protectLink?<p className={styles.accessNote}>You can add a password later in Sharing history.</p>:null}
   {error?<p role="alert" className={styles.error}>{error}</p>:null}
  </div>
 </AssetAccessSettingsDialog>;
 if(step==='risk') return <ShareDisclosureDialog title="Before you share" titleId={titleId} closeLabel="Close dialog" onClose={onClose} className={ownerStyles.inviteDialog}>
   <form className={ownerStyles.form} onSubmit={e=>e.preventDefault()}><fieldset disabled={busy}>
   <ShareDisclaimer accepted={accepted} onChange={setAccepted} disabled={busy} disclosure={`${channel==='link'?'Anyone with this link':recipients.find(r=>r.email===email)?.business_name||email} can view the shared parts${password?' after entering the password':''}. ${download?'Downloads are allowed. ':''}${enquiry?'Enquiries are allowed. ':''}Downloads and enquiries require a verified Aim4price account. Links can be forwarded. Private fields stay private.`}/>
   {footer}
   </fieldset></form>{error?<p role="alert">{error}</p>:null}
 </ShareDisclosureDialog>;
 if(step==='send') return <ShareDisclosureDialog title="Send link" titleId={titleId} closeLabel="Close dialog" onClose={onClose} className={ownerStyles.inviteDialog}>
   <ShareLinkDelivery link={url} copy={{subject:name,body:`Parts shared with you: ${url}`}} description="The selected parts list will be shared with the same permissions." previewLabel="Preview parts"
   hint={`Choose the recipient in WhatsApp or your email app. ${channel==='direct'?'Only the selected business account can open this link.':'Anyone with this link can view the shared parts.'} Downloads and enquiries require a verified Aim4price account and the permissions you selected. ${password?'Send the password separately. ':''}You can revoke the link in History.`}/>
 </ShareDisclosureDialog>;
 return <PartsBusinessPicker name={name} count={count} network={network} api={api} selected={email} onSelect={business=>{setEmail(business?.email||'');setRecipients(business?[business]:[]);setAccepted(false);}} onContinue={()=>setStep('permissions')} onClose={()=>setStep('choose')}/>;
}
