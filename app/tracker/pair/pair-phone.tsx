"use client";
import {useEffect,useState,useRef} from 'react';
import {normalizeTrackerCode,trackerPairingIntent,TRACKER_INSTALL_URL} from '../../../lib/asset-tracking-links';
import styles from './page.module.css';
export default function PairPhone(){
 const consumed=useRef(false);
 const [code,setCode]=useState<string|null>(null),[ready,setReady]=useState(false);
 useEffect(()=>{if(consumed.current)return;consumed.current=true;setCode(normalizeTrackerCode(window.location.hash.slice(1)));window.history.replaceState(null,'',window.location.pathname);setReady(true);},[]);
 return <main className={styles.page}><section className={styles.card}><p className={styles.brand}>Aim4price Tracker</p><h1>Connect this phone</h1>{!ready?<p>Reading pairing code…</p>:code?<>
 <p>Open the tracker, check the code and tap <strong>Connect</strong>. Then tap <strong>Activate</strong> to start recording.</p>
 <a className={styles.primary} href={trackerPairingIntent(code)!}>Open Tracker →</a>
 <p className={styles.label}>Or enter this code in the app</p><output className={styles.code}>{code}</output>
 <p>Keep this code private. If it has expired, create a new one in Tracking device.</p>
 <details><summary>Tracker not installed?</summary><p><a href={TRACKER_INSTALL_URL}>Install the Android app</a>, then scan the code again. Already installed but the code does not fill in? Enter the code above manually.</p></details>
 </>:<p>This pairing link is incomplete. Create a new code in Tracking device and scan its QR code.</p>}</section></main>;
}
