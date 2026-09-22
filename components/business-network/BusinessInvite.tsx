'use client';
import { useState } from 'react';
import styles from './BusinessNetwork.module.css';
export default function BusinessInvite(){
 const [notice,setNotice]=useState('');
 return <section className={styles.panel}><strong>Invite a business yourself</strong><p>Send the acceptance link from your own email or WhatsApp. Aim4price records the response; an admin publishes the listing.</p>
 <a href="/business-network/accept" target="_blank" rel="noreferrer">Open acceptance page</a>
 <button type="button" className={styles.button} onClick={async()=>{const url=`${window.location.origin}/business-network/accept`;try{await navigator.clipboard.writeText(url);setNotice('Acceptance link copied.');}catch{setNotice(url);}}}>Copy acceptance link</button>
 {notice&&<p role="status">{notice}</p>}</section>;
}
