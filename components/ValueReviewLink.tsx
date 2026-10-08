'use client';
import {useEffect,useState} from 'react';
import AssetValueDialog from './asset-register/AssetValueDialog';
import LeadActionDialog from './leads/LeadActionDialog';
import Link from 'next/link';
import styles from '../app/asset-register/page.module.css';
export default function ValueReviewLink({assetId,requestId}:{assetId:string;requestId:string}){
 const [title,setTitle]=useState(''),[error,setError]=useState(''),[signIn,setSignIn]=useState(false);
 const endpoint=`/api/asset-register/${assetId}/value`;
 useEffect(()=>{fetch(`${endpoint}?valueRequest=${requestId}`,{cache:'no-store'}).then(async r=>{if(r.status===401){setSignIn(true);return;}const d=await r.json();if(!r.ok)throw Error(d.error);setTitle(d.asset.title);}).catch(e=>setError(e.message));},[endpoint,requestId]);
 const close=()=>{window.location.href='/asset-register';};
 if(title)return <AssetValueDialog endpoint={endpoint} initialRequestId={requestId} assetTitle={title} onClose={close}/>;
 return <LeadActionDialog title={signIn?'Oops, we need you to sign in...':'Review current value'} assetTitle="Asset value suggestion" onClose={close}>{signIn?<div><p>Sign in with the account that owns this asset to review the suggestion.</p><Link className={styles.primaryButton} href={`/auth?returnTo=${encodeURIComponent(`/value-review/${assetId}/${requestId}`)}#login`}>Sign in</Link></div>:<p role={error?'alert':'status'}>{error||'Loading suggestion…'}</p>}</LeadActionDialog>;
}
