'use client';
import { useEffect, useId, useState } from 'react';
import ShareDisclosureDialog from './asset-register/ShareDisclosureDialog';
import styles from './PartsShareFlow.module.css';
import AssetAccessSettingsDialog from './asset-register/AssetAccessSettingsDialog';
import ShareDisclaimer from './asset-register/ShareDisclaimer';
import ShareLinkDelivery from './asset-register/ShareLinkDelivery';
import ownerStyles from './business-network/BusinessListingInvite.module.css';
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
 const permissions=<>
  <p className={styles.lead}>Choose what recipients can do.</p>
  <div className={ownerStyles.permissions} data-permission-grid>
   <div className={ownerStyles.permission}><strong>View parts</strong><span>{channel==='link'?'Anyone with the link can view.':'Only the selected business can view.'}</span></div>
   <label className={ownerStyles.permission}><input type="checkbox" checked={download} onChange={e=>{setDownload(e.target.checked);setAccepted(false);}}/><span><strong>Download parts</strong><small>Save the owner’s branded PDF</small></span></label>
   <label className={ownerStyles.permission}><input type="checkbox" checked={enquiry} onChange={e=>{setEnquiry(e.target.checked);setAccepted(false);}}/><span><strong>Send enquiries</strong><small>Contact you about this parts list</small></span></label>
  </div>
  <p className={styles.hint}>Downloads and enquiries require a verified Aim4price account. Editing and sharing controls stay with you.</p>
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
 const passwordSettings=(<>{permissions}
    {step==='settings'?<label className={styles.check}><input type="checkbox" checked={replacePassword} onChange={e=>setReplacePassword(e.target.checked)}/>Change or remove the password</label>:null}
    {(step==='permissions'||replacePassword)?<div className={styles.field}><label htmlFor={passwordId}>Link password <span className={styles.hint}>(optional)</span></label><div className={styles.password}><input id={passwordId} type={showPassword?"text":"password"} autoComplete="new-password" maxLength={128} value={password} onChange={e=>{setPassword(e.target.value);setAccepted(false);}} placeholder="At least 8 characters"/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-controls={passwordId} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPassword?<path d="m3 3 18 18"/>:null}</svg></button></div><small>{step==='settings'?'Leave blank to remove password protection.':'Send the password separately to your recipient.'}</small></div>:null}
</>
);
 if(step==='permissions') return <AssetAccessSettingsDialog key={channel} title="Parts link settings" assetTitle={name} linkSettings onClose={onClose}
   guideDescription={channel==='link'?'Anyone with your link can view the shared parts.':'Only the selected business can open your link.'}
   permissionsDescription="Choose downloads and enquiries."
   onViewOnly={()=>{setDownload(false);setEnquiry(false);setAccepted(false);}}
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
   {step==='choose'?<><p className={styles.lead}>{count} {count===1?"part":"parts"} · Choose how to share</p><div className={styles.choices}>
    <button className={styles.amber} onClick={()=>{setChannel('link');setStep('permissions');setAccepted(false);}}><span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(2 1)"/></svg></span><strong>Share link</strong><small>Let anyone open your parts list</small></button>
    <button onClick={()=>{setChannel('direct');setStep('recipient');setAccepted(false);}}><span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 21V7l9-4 9 4v14M1 21h22M7 21V11h10v10M8 7h8"/></svg></span><strong>Inside Aim4price</strong><small>Choose an approved directory business</small></button>
   </div><button className={styles.history} onClick={()=>void run(history)}><strong>Sharing history</strong><span>Manage links, passwords and access →</span></button></>:null}
   {step==='recipient'?<><p className={styles.lead}>Choose one approved business.</p><form className={styles.search} onSubmit={e=>{e.preventDefault();void run(async()=>{setEmail('');const data=await api(undefined,`?view=recipients&network=${encodeURIComponent(network)}&search=${encodeURIComponent(search)}`);setRecipients(data.recipients||[]);setSearched(true);setPage(0);});}}><input aria-label="Find sharing recipient" placeholder="Business name or town" value={search} onChange={e=>{setSearch(e.target.value);setEmail('');}}/><button disabled={busy}>Search</button></form>
    <p className={styles.hint}>Only approved directory businesses with an active Aim4price account are listed.</p>
    {recipients.slice(page*3,page*3+3).map(r=><button className={styles.recipient} key={r.email} aria-pressed={email===r.email} onClick={()=>setEmail(r.email)}><span><strong>{r.business_name||r.email}</strong><small>{r.town_city||r.email}</small></span><span>{email===r.email?'Selected':'Select'}</span></button>)}
    {searched&&!recipients.length?<p>No matching businesses. Try another name or use Share link.</p>:null}
    {recipients.length>3?<nav className={styles.pager}><button disabled={!page} onClick={()=>setPage(page-1)}>Previous businesses</button><span>{page+1} / {Math.ceil(recipients.length/3)}</span><button disabled={(page+1)*3>=recipients.length} onClick={()=>setPage(page+1)}>Next businesses</button></nav>:null}
   </>:null}
   {step==='settings'?passwordSettings:null}
   {step==='history'?<><p className={styles.lead}>Manage your shared links and access.</p>{!links.length?<p>No shared links yet.</p>:null}{links.slice(page*4,page*4+4).map(link=><article className={styles.link} key={link.id}><div><strong>{link.recipient_name||'Anyone with the link'}</strong><small>{new Date(link.created_at).toLocaleDateString()} · {link.revoked_at?'Revoked':link.protected?'Password protected':'Active'}</small></div><div className={styles.actions}>{!link.revoked_at?<a href={link.url} target="_blank" rel="noreferrer">Open</a>:null}<button onClick={()=>{setSelected(link);setChannel(link.recipient_id?'direct':'link');setDownload(link.allow_download);setEnquiry(link.allow_enquiry);setPassword('');setShowPassword(false);setReplacePassword(false);setStep('settings');}}>Settings</button></div></article>)}{links.length>4?<nav className={styles.pager}><button disabled={!page} onClick={()=>setPage(page-1)}>Previous links</button><span>{page+1} / {Math.ceil(links.length/4)}</span><button disabled={(page+1)*4>=links.length} onClick={()=>setPage(page+1)}>Next links</button></nav>:null}</>:null}
   {step==='settings'&&selected?<div className={styles.actions}>{confirm?<div className={styles.notice}><strong>{confirm==='delete-share'?'Delete this link from history?':'Revoke access to this link?'}</strong><p>The link will stop working for everyone.</p><button onClick={()=>setConfirm(null)}>Keep link</button><button className={styles.danger} disabled={busy} onClick={()=>void run(async()=>{await api({action:confirm,network,id:selected.id});await history();})}>Confirm {confirm==='delete-share'?'delete':'revoke'}</button></div>:<><button className={styles.danger} disabled={!!selected.revoked_at} onClick={()=>setConfirm('revoke-share')}>Revoke access</button><button className={styles.danger} onClick={()=>setConfirm('delete-share')}>Delete link</button></>}</div>:null}
   {error?<p role="alert" className={styles.error}>{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  </div>
  {footer}
 </ShareDisclosureDialog>;
}
