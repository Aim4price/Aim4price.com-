'use client';
import {useEffect,useState} from 'react';
import styles from './InlineBillingInvoice.module.css';

export default function InlineBillingInvoice({id}:{id:string}) {
 const [html,setHtml]=useState(''),[ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const controller=new AbortController();setHtml('');setReady(false);setError('');void fetch(`/api/billing/invoices/${id}`,{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('Your invoice could not be loaded. Please try again.');return response.text();}).then(content=>{if(!controller.signal.aborted)setHtml(content);}).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});return()=>controller.abort();},[id,attempt]);
 return <section className={styles.document} aria-label="Suspension invoice">
  <header><h2>Your invoice</h2>{ready&&!error?<a href={`/api/billing/invoices/${id}?format=pdf`} download>Download PDF</a>:null}</header>
  {error?<div role="alert" className={styles.message}><p>{error}</p><button onClick={()=>setAttempt(value=>value+1)}>Try again</button></div>:!ready?<p role="status" className={styles.message}>Loading your invoice…</p>:null}
  {html?<iframe title="Suspension invoice document" sandbox="" srcDoc={html} onLoad={()=>setReady(true)}/>:null}
 </section>;
}
