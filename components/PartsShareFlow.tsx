'use client';
import { useEffect, useId, useState } from 'react';
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
 const [showPassword,setShowPassword]=useState(false);
 const [step,setStep]=useState('choose'),[channel,setChannel]=useState('link'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [email,setEmail]=useState(''),[search,setSearch]=useState(''),[recipients,setRecipients]=useState<Recipient[]>([]),[searched,setSearched]=useState(false);
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
  <footer className={isOwnerStep?ownerStyles.footer:styles.footer}>
   <button className={isOwnerStep?ownerStyles.copy:undefined} disabled={busy} onClick={()=>{setError('');setNotice('');if(step==='choose')onClose();else if(step==='settings')void run(history);else setStep(step==='risk'?'permissions':step==='permissions'&&channel==='direct'?'recipient':'choose');}}>{step==='choose'?'Cancel':step==='history'?'Share options':'Back'}</button>
   {step==='recipient'?<button className={isOwnerStep?ownerStyles.primary:styles.primary} disabled={!email||busy} onClick={()=>setStep('permissions')}>Continue</button>:null}
   {step==='permissions'?<button className={isOwnerStep?ownerStyles.primary:styles.primary} disabled={busy||!!password&&password.length<8} onClick={()=>setStep('risk')}>Continue</button>:null}
   {step==='risk'?<button className={isOwnerStep?ownerStyles.primary:styles.primary} disabled={!accepted||busy} onClick={()=>void run(async()=>{const data=await api({action:'create-share',network,channel,email,allowDownload:download,allowEnquiry:enquiry,password,accepted});setUrl(data.url);setStep('send');})}>Create parts link</button>:null}
   {step==='settings'&&!confirm?<button className={isOwnerStep?ownerStyles.primary:styles.primary} disabled={busy||!!selected?.revoked_at||replacePassword&&!!password&&password.length<8} onClick={()=>void run(async()=>{await api({action:'update-share',network,id:selected?.id,allowDownload:download,allowEnquiry:enquiry,...(replacePassword?{password}:{})});await history();})}>Save settings</button>:null}
   {step==='send'||step==='history'?<button className={isOwnerStep?ownerStyles.primary:styles.primary} onClick={onClose}>Done</button>:null}
  </footer>);
 const passwordSettings=(<div className={styles.settingsContent}>{permissions}
    {step==='settings'?<label className={styles.check}><input type="checkbox" checked={replacePassword} onChange={e=>setReplacePassword(e.target.checked)}/>Change or remove the password</label>:null}
    {(step==='permissions'||replacePassword)?<div className={styles.passwordPanel}><div className={styles.passwordHeading}><span className={styles.permissionIcon}>{permissionIcon('lock')}</span><div><label htmlFor={passwordId}>Link password <span>(optional)</span></label><p>Send the password separately.</p></div></div><div className={styles.passwordControl}><div className={styles.password}><input id={passwordId} type={showPassword?"text":"password"} autoComplete="new-password" maxLength={128} value={password} onChange={e=>{setPassword(e.target.value);setAccepted(false);}} placeholder="At least 8 characters"/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-controls={passwordId} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPassword?<path d="m3 3 18 18"/>:null}</svg></button></div><small>{step==='settings'?'Leave blank to remove protection.':password?(password.length<8?'Use at least 8 characters.':'Password protection is enabled.'):'Leave blank for access without a password.'}</small></div></div>:null}
</div>
);
 const editLink=(link:LinkItem)=>{setSelected(link);setChannel(link.recipient_id?'direct':'link');setDownload(link.allow_download);setEnquiry(link.allow_enquiry);setPassword('');setShowPassword(false);setReplacePassword(false);setConfirm(null);setError('');setStep('settings');};
 const linkIcon=<svg className={historyStyles.linkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2"/></svg>;
 if(step==='choose') return <AssetAccessSettingsDialog subjectHeader title={name} assetTitle={`${count} ${count===1?'part':'parts'} · Choose how to share`} onClose={onClose}>
  <div className={choiceStyles.destinationBody}><div className={`${choiceStyles.grid} ${choiceStyles.pickerGrid}`}>
   <button type="button" className={choiceStyles.card} data-tone="link" disabled={busy} onClick={()=>{setChannel('link');setStep('permissions');setAccepted(false);}}><span className={choiceStyles.icon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2"/></svg></span><span className={choiceStyles.copy}><strong>Share link</strong><small>Share your parts list with anyone</small></span></button>
   <button type="button" className={choiceStyles.card} disabled={busy} onClick={()=>{setChannel('direct');setStep('recipient');setAccepted(false);}}><span className={choiceStyles.icon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 21V7l9-4 9 4v14M1 21h22M7 21V11h10v10M8 7h8"/></svg></span><span className={choiceStyles.copy}><strong>Inside Aim4price</strong><small>Choose an approved directory business</small></span></button>
  </div><div className={destinationStyles.historyActions}><button type="button" disabled={busy} onClick={()=>void run(history)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2"/></svg><span>Sharing history</span><span className={destinationStyles.historyHint}>Manage shared links</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></div></div>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
 </AssetAccessSettingsDialog>;
 if(step==='history') return <AssetAccessSettingsDialog title="Sharing history" assetTitle={name} onClose={onClose}>
  <div className={historyStyles.panel} data-share-history><p className={historyStyles.intro}>Manage your shared links and access.</p>
   {error?<p role="alert" className={historyStyles.error}>{error}</p>:null}
   {!links.length?<p className={historyStyles.empty}>No shared links yet.</p>:<div className={historyStyles.list} aria-busy={busy}>{links.slice(page*4,page*4+4).map(link=><article className={historyStyles.row} key={link.id}>{linkIcon}<div className={historyStyles.details}><strong>{link.recipient_name||'Shared link'}</strong><small>{new Date(link.created_at).toLocaleString('en-ZA',{dateStyle:'medium',timeStyle:'short'})}{link.protected?' · Password protected':''}</small></div><span className={historyStyles.status} data-revoked={!!link.revoked_at}>{link.revoked_at?'Access revoked':'Active'}</span><div className={historyStyles.actions}>{link.revoked_at?<button className={historyStyles.revoke} disabled={busy} onClick={()=>{setSelected(link);setConfirm('delete-share');}}>Delete</button>:<><a href={link.url} target="_blank" rel="noreferrer">Open</a><button disabled={busy} onClick={()=>editLink(link)}>Settings</button><button className={historyStyles.revoke} disabled={busy} onClick={()=>{setSelected(link);setConfirm('revoke-share');}}>Revoke access</button></>}</div></article>)}</div>}
   {confirm&&selected?<div className={styles.notice} role="group" aria-label="Confirm link change"><strong>{confirm==='delete-share'?'Delete this link from history?':'Revoke access to this link?'}</strong><p>The link will stop working for everyone.</p><div className={historyStyles.actions}><button disabled={busy} onClick={()=>{setConfirm(null);setSelected(null);}}>Keep link</button><button className={historyStyles.revoke} disabled={busy} onClick={()=>void run(async()=>{await api({action:confirm,network,id:selected.id});await history();})}>Confirm {confirm==='delete-share'?'delete':'revoke'}</button></div></div>:null}
   <footer><button className={historyStyles.backButton} disabled={busy} onClick={()=>{setConfirm(null);setSelected(null);setStep('choose');}}>Share options</button><span className={historyStyles.page}>Page {page+1}</span>{page>0?<button disabled={busy} onClick={()=>setPage(page-1)}>Previous links</button>:null}{(page+1)*4<links.length?<button disabled={busy} onClick={()=>setPage(page+1)}>Next links</button>:null}</footer>
  </div>
 </AssetAccessSettingsDialog>;
 if(step==='settings') return <AssetAccessSettingsDialog title="Parts link settings" assetTitle={name} compactLayout onClose={()=>void run(history)} footer={footer}>
  {passwordSettings}
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
 </AssetAccessSettingsDialog>;
 if(step==='permissions') return <AssetAccessSettingsDialog key={channel} title="Parts link settings" assetTitle={name} compactLayout linkSettings onClose={onClose}
   guideDescription={channel==='link'?'Anyone with your link can view the shared parts.':'Only the selected business can open your link.'}
   permissionsDescription="Choose downloads and enquiries."
   onViewOnly={()=>{setDownload(false);setEnquiry(false);setAccepted(false);setStep('risk');}}
   footer={<div data-access-actions className={assetStyles.formActions}><button type="button" className={assetStyles.secondaryButton} onClick={()=>setStep(channel==='direct'?'recipient':'choose')}>Back</button><button type="button" className={assetStyles.primaryButton} disabled={busy||!!password&&password.length<8} onClick={()=>setStep('risk')}>Continue</button></div>}>
   {passwordSettings}
   {error?<p role="alert">{error}</p>:null}
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
 return <ShareDisclosureDialog title={titles[step]} titleId={titleId} closeLabel="Close dialog" onClose={onClose} className={styles.dialog}>
  <div className={styles.body} aria-busy={busy}>
   {step==='recipient'?<><p className={styles.lead}>Choose one approved business.</p><form className={styles.search} onSubmit={e=>{e.preventDefault();void run(async()=>{setEmail('');const data=await api(undefined,`?view=recipients&network=${encodeURIComponent(network)}&search=${encodeURIComponent(search)}`);setRecipients(data.recipients||[]);setSearched(true);setPage(0);});}}><input aria-label="Find sharing recipient" placeholder="Business name or town" value={search} onChange={e=>{setSearch(e.target.value);setEmail('');}}/><button disabled={busy}>Search</button></form>
    <p className={styles.hint}>Only approved directory businesses with an active Aim4price account are listed.</p>
    {recipients.slice(page*3,page*3+3).map(r=><button className={styles.recipient} key={r.email} aria-pressed={email===r.email} onClick={()=>setEmail(r.email)}><span><strong>{r.business_name||r.email}</strong><small>{r.town_city||r.email}</small></span><span>{email===r.email?'Selected':'Select'}</span></button>)}
    {searched&&!recipients.length?<p>No matching businesses. Try another name or use Share link.</p>:null}
    {recipients.length>3?<nav className={styles.pager}><button disabled={!page} onClick={()=>setPage(page-1)}>Previous businesses</button><span>{page+1} / {Math.ceil(recipients.length/3)}</span><button disabled={(page+1)*3>=recipients.length} onClick={()=>setPage(page+1)}>Next businesses</button></nav>:null}
   </>:null}
   {error?<p role="alert" className={styles.error}>{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  </div>
  {footer}
 </ShareDisclosureDialog>;
}
