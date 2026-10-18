'use client';
import {useState} from 'react';
import AssetAccessSettingsDialog from './AssetAccessSettingsDialog';
import QrCodePreview from '../QrCodePreview';
import styles from './TrackerInstallShareDialog.module.css';
import { TRACKER_INSTALL_URL as INSTALL_URL } from '../../lib/asset-tracking-links';
const MESSAGE=`Install Aim4price Tracker on the equipment’s Android phone: ${INSTALL_URL}\n\nAfter installing, enter the pairing code provided by the asset owner and tap Activate.`;
function Icon({kind}:{kind:'share'|'copy'|'phone'}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='copy'?<><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>:kind==='phone'?<><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/></>:<path fill="currentColor" stroke="none" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.875 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.892-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.892 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.14 1.588 5.945L.057 24l6.3-1.654a11.882 11.882 0 0 0 5.69 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>}</svg>}
export default function TrackerInstallShareDialog({onClose}:{onClose:()=>void}){
 const [copied,setCopied]=useState(false),[error,setError]=useState('');
 async function copy(){setError('');try{await navigator.clipboard.writeText(INSTALL_URL);setCopied(true);}catch{setError('Select the link below and copy it manually.');}}
 return <AssetAccessSettingsDialog locationLayout title="Install Tracker" assetTitle="For the equipment’s Android phone." onClose={onClose}>
  <div className={styles.layout} data-tracker-install>
   <div className={styles.sharePanel}>
    <div className={styles.intro}><span className={styles.phone}><Icon kind="phone"/></span><div><h4>Send app link</h4></div></div>
    <a className={`${styles.action} ${styles.whatsapp}`} href={`https://wa.me/?text=${encodeURIComponent(MESSAGE)}`} target="_blank" rel="noopener noreferrer"><Icon kind="share"/><span><strong>WhatsApp</strong></span><svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></a>
    <button className={styles.action} type="button" onClick={()=>void copy()}><Icon kind="copy"/><span><strong>{copied?'Link copied':'Copy link'}</strong></span><svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={copied?"m5 12 4 4L19 6":"m9 5 7 7-7 7"}/></svg></button>
    <span className={styles.status} role="status" aria-live="polite">{copied?'Installation link copied.':''}</span>
    {error&&<div className={styles.fallback}><p role="alert">{error}</p><input aria-label="Installation link" readOnly value={INSTALL_URL} onFocus={event=>event.target.select()}/></div>}
   </div>
   <div className={styles.qrPanel}><h4>Scan to install</h4><div className={styles.qr}><QrCodePreview value={INSTALL_URL} label="Scan to download Aim4price Tracker for Android"/></div><p>Use the phone’s camera</p></div>
  </div>
 </AssetAccessSettingsDialog>;
}
