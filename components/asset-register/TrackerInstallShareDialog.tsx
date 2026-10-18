'use client';
import {useState} from 'react';
import AssetAccessSettingsDialog from './AssetAccessSettingsDialog';
import QrCodePreview from '../QrCodePreview';
import styles from './TrackerInstallShareDialog.module.css';
import { TRACKER_INSTALL_URL as INSTALL_URL } from '../../lib/asset-tracking-links';
const MESSAGE=`Install Aim4price Tracker on the equipment’s Android phone: ${INSTALL_URL}\n\nAfter installing, enter the pairing code provided by the asset owner and tap Activate.`;
function Icon({kind}:{kind:'share'|'copy'|'phone'}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='copy'?<><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>:kind==='phone'?<><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/></>:<><path d="M20 11.5a8 8 0 0 1-12 7L3 20l1.5-5a8 8 0 1 1 15.5-3.5Z"/><path d="M8 8c0 4 4 8 8 8l1-3-3-1-1 1-2-2 1-1-1-3Z"/></>}</svg>}
export default function TrackerInstallShareDialog({onClose}:{onClose:()=>void}){
 const [copied,setCopied]=useState(false),[error,setError]=useState('');
 async function copy(){setError('');try{await navigator.clipboard.writeText(INSTALL_URL);setCopied(true);}catch{setError('Select the link below and copy it manually.');}}
 return <AssetAccessSettingsDialog locationLayout title="Install Aim4price Tracker" assetTitle="Send the link or scan below on the equipment’s Android phone." onClose={onClose}>
  <div className={styles.layout} data-tracker-install>
   <div className={styles.sharePanel}>
    <div className={styles.intro}><span className={styles.phone}><Icon kind="phone"/></span><div><h4>Send to the phone</h4><p>Share directly with the person setting up the phone.</p></div></div>
    <a className={`${styles.action} ${styles.whatsapp}`} href={`https://wa.me/?text=${encodeURIComponent(MESSAGE)}`} target="_blank" rel="noopener noreferrer"><Icon kind="share"/><span><strong>WhatsApp</strong><small>Choose who to send it to</small></span><b aria-hidden="true">↗</b></a>
    <button className={styles.action} type="button" onClick={()=>void copy()}><Icon kind="copy"/><span><strong>{copied?'Link copied':'Copy link'}</strong><small>{copied?'Ready to paste into your message':'Paste into a message or email'}</small></span><b aria-hidden="true">{copied?'✓':'→'}</b></button>
    <span className={styles.status} role="status" aria-live="polite">{copied?'Installation link copied.':''}</span>
    {error&&<div className={styles.fallback}><p role="alert">{error}</p><input aria-label="Installation link" readOnly value={INSTALL_URL} onFocus={event=>event.target.select()}/></div>}
   </div>
   <div className={styles.qrPanel}><span className={styles.eyebrow}>Or use the phone’s camera</span><h4>Scan to install</h4><div className={styles.qr}><QrCodePreview value={INSTALL_URL} label="Scan to download Aim4price Tracker for Android"/></div><p>Scan this QR code to download the Android app.</p></div>
  </div>
  <div className={styles.nextStep}><span aria-hidden="true">✓</span><p><strong>Once installed</strong><br/>Return to Tracking device, create a pairing code and scan it with the phone.</p></div>
  <p className={styles.note}>If Android asks, allow your browser to install this app.</p>
 </AssetAccessSettingsDialog>;
}
