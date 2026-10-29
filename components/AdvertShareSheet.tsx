'use client';
import {useEffect,useRef,useState} from 'react';
import {MarketplaceShareDialog} from './FacebookAdvertActions';
import {downloadMarketplaceAd} from '../lib/marketplace-ad-renderer';
import type {MarketplaceListing} from '../lib/marketplace';
import StudioIcon from './StudioIcon';
import styles from './AdvertShareSheet.module.css';

export default function AdvertShareSheet({listing,shareUrl,caption,prepareAdvert,onClose}:{
  listing:MarketplaceListing;shareUrl:string;caption:string;prepareAdvert:()=>Promise<File>;onClose:()=>void;
}) {
  const ref=useRef<HTMLDialogElement>(null);
  const [channel,setChannel]=useState<'whatsapp'|'facebook'|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    const trigger=document.activeElement as HTMLElement|null;
    ref.current?.showModal();
    return ()=>{ref.current?.close();trigger?.focus();};
  },[]);
  async function copy(value:string) {try {await navigator.clipboard.writeText(value);setMessage('Copied.');}catch{setMessage('Copy is unavailable in this browser.');}}
  async function download() {
    setBusy(true);setMessage('');
    try {const file=await prepareAdvert();downloadMarketplaceAd(file,file.name);}
    catch {setMessage('Could not prepare the advert. Please try again.');}
    finally {setBusy(false);}
  }
  return <>
    <dialog role="dialog" ref={ref} className={styles.dialog} onCancel={onClose} aria-labelledby="advert-share-title">
      <header><div><h2 id="advert-share-title">Share your advert</h2><p>Send the advert, photos or listing link.</p></div><button type="button" data-modal-close="true" aria-label="Close sharing" onClick={onClose}>×</button></header>
      <div className={styles.summary}><img src={listing.imageSrc} alt="" /><div><strong>{listing.title}</strong><span>{listing.location}</span></div></div>
      <div className={styles.actions}>
        <button type="button" onClick={()=>setChannel('whatsapp')}><img src="/brand/whatsapp.png" alt="" />WhatsApp</button>
        <button type="button" onClick={()=>setChannel('facebook')}><img src="/brand/facebook.png" alt="" />Facebook</button>
        <button type="button" disabled={!shareUrl} onClick={()=>void copy(shareUrl)}><StudioIcon name="copy" />Copy link</button>
        <button type="button" disabled={busy} onClick={()=>void download()}><StudioIcon name="download" />{busy?'Preparing…':'Download PNG'}</button>
      </div>
      {shareUrl ? <label>Direct link<input readOnly value={shareUrl} onFocus={event=>event.target.select()} /></label> : <p>Publish to Marketplace &amp; showroom to get a listing link. You can share the advert and photos now.</p>}
      <button type="button" className={styles.caption} onClick={()=>void copy(caption)}>Copy advert text</button>
      {message ? <p role="status">{message}</p>:null}
    </dialog>
    {channel ? <MarketplaceShareDialog listing={listing} initialCaption={caption} prepareAdvert={prepareAdvert} whatsappUrl={channel==='whatsapp'?shareUrl:undefined} onClose={()=>setChannel(null)} />:null}
  </>;
}
