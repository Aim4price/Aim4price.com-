'use client';
import {useState} from 'react';
import AssetAccessSettingsDialog from './AssetAccessSettingsDialog';
import QrCodePreview from '../QrCodePreview';
import styles from './TrackerInstallShareDialog.module.css';
const INSTALL_URL='https://www.aim4price.com/downloads/aim4price-tracker-pilot.apk';
const MESSAGE=`Install Aim4price Tracker on the equipment’s Android phone: ${INSTALL_URL}\n\nAfter installing, enter the pairing code provided by the asset owner and tap Activate.`;
function Icon({kind}:{kind:'share'|'copy'|'phone'}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='copy'?<><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>:kind==='phone'?<><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/></>:<><path d="M20 11.5a8 8 0 0 1-12 7L3 20l1.5-5a8 8 0 1 1 15.5-3.5Z"/><path d="M8 8c0 4 4 8 8 8l1-3-3-1-1 1-2-2 1-1-1-3Z"/></>}</svg>}
export default function TrackerInstallShareDialog({onClose}:{onClose:()=>void}){
 const [copied,setCopied]=useState(false),[error,setError]=useState('');
 async function copy(){setError('');try{await navigator.clipboard.writeText(INSTALL_URL);setCopied(true);}catch{setError('Select the link below and copy it manually.');}}
 return <AssetAccessSettingsDialog title="Send installation link" assetTitle="Get Aim4price Tracker onto the equipment’s Android phone." onClose={onClose}>
  <div className={styles.layout}>
   <div className={styles.sharePanel}>
    <div className={styles.intro}><span className={styles.phone}><Icon kind="phone"/></span><div><h4>Send it to the phone</h4><p>Choose WhatsApp or copy the link to share it yourself.</p></div></div>
    <a className={`${styles.action} ${styles.whatsapp}`} href={`https://wa.me/?text=${encodeURIComponent(MESSAGE)}`} target="_blank" rel="noopener noreferrer"><Icon kind="share"/><span><strong>WhatsApp</strong><small>Choose who to send it to</small></span><b aria-hidden="true">↗</b></a>
    <button className={styles.action} type="button" onClick={()=>void copy()}><Icon kind="copy"/><span><strong>{copied?'Link copied':'Copy link'}</strong><small>{copied?'Ready to paste into your message':'Paste into a message or email'}</small></span><b aria-hidden="true">{copied?'✓':'→'}</b></button>
    <span className={styles.status} role="status" aria-live="polite">{copied?'Installation link copied.':''}</span>
    {error&&<div className={styles.fallback}><p role="alert">{error}</p><input aria-label="Installation link" readOnly value={INSTALL_URL} onFocus={event=>event.target.select()}/></div>}
   </div>
   <div className={styles.qrPanel}><span className={styles.eyebrow}>PHONE WITH YOU?</span><h4>Scan to install</h4><div className={styles.qr}><QrCodePreview value={INSTALL_URL} label="Scan to download Aim4price Tracker for Android"/></div><p>Open the phone’s camera and point it at this code.</p></div>
  </div>
  <div className={styles.nextStep}><span>Next</span><p>Install the app on the phone, then return here to <strong>create a pairing code</strong> for this asset.</p></div>
  <div className={styles.footer}><p>Already on the equipment phone?</p><a href={INSTALL_URL} download>Download Android app <span aria-hidden="true">↓</span></a></div>
  <p className={styles.note}>Android pilot app. Your phone may ask you to allow installation from your browser. This link installs the app; it does not grant access to your asset records.</p>
 </AssetAccessSettingsDialog>;
}
