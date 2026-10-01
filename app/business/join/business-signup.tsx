'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import SignupFlow from '../../../components/SignupFlow';
import styles from '../../../components/SignupFlow.module.css';

export default function BusinessSignup({returnTo,initialEmail=''}:{returnTo:string|null;initialEmail?:string}) {
 const [chosen,setChosen]=useState(false);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[createdEmail,setCreatedEmail]=useState('');
 const destination=returnTo||'/business';
 async function verify(email:string) {
  const response=await fetch('/api/auth/send-verification-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,callbackURL:destination})});
  if(!response.ok)throw Error('Your account is ready, but the verification email could not be sent. Please try again.');
  setNotice('Check your inbox and verify your email to continue.');
 }
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();if(busy)return;
  const form=new FormData(event.currentTarget),email=String(form.get('email')||'').trim();
  setBusy(true);setNotice('');
  try {
   const response=await fetch('/api/auth/sign-up/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:String(form.get('name')||'').trim(),businessName:String(form.get('businessName')||'').trim(),email,password:form.get('password'),acceptedTerms:form.get('terms')==='on',accountType:'business',accountSubtype:'contributor',accountAccess:'free',callbackURL:destination})});
   const data=await response.json().catch(()=>null);
   if(!response.ok)throw Error(data?.message||'Unable to create your account. If you already have one, sign in instead.');
   setCreatedEmail(email);await verify(email);
  }catch(error){setNotice(error instanceof Error?error.message:'Please try again.');}finally{setBusy(false);}
 }
 if(!chosen)return <SignupFlow title="Choose your access" description="Start free or set up your full Aim4price workspace." returnTo={returnTo}><div className={styles.guestActions}><button className={styles.button} onClick={()=>setChosen(true)}>Free sharing account</button><Link className={styles.secondaryButton} href={`/auth?accountType=dealer&accountAccess=desktop${returnTo?'&returnTo='+encodeURIComponent(returnTo):''}#signup`}>Full Aim4price Desktop</Link></div></SignupFlow>;
 return <SignupFlow title={createdEmail?'Check your email':'Create your free account'} description={createdEmail?`Verify ${createdEmail} to open your shared enquiries.`:'Save your shared enquiries in one place. Upgrade when you need the full Aim4price Desktop.'} returnTo={returnTo}>
  {createdEmail?<div className={styles.guestActions}><button className={styles.secondaryButton} disabled={busy} onClick={async()=>{setBusy(true);try{await verify(createdEmail);}catch(error){setNotice((error as Error).message);}finally{setBusy(false);}}}>Resend verification email</button><Link className={styles.button} href={destination}>Continue</Link></div>:<form className={styles.form} onSubmit={submit}>
   <label>Your name<input name="name" autoComplete="name" required maxLength={150}/></label>
   <label>Business name<input name="businessName" autoComplete="organization" required maxLength={200}/></label>
   <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} defaultValue={initialEmail}/></label>
   <label>Password<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/></label>
   <label className={styles.check}><input name="terms" type="checkbox" required/><span>I accept the <Link href="/terms-of-service" target="_blank">Terms</Link> and <Link href="/privacy-policy" target="_blank">Privacy Policy</Link>.</span></label>
   <button type="submit" className={styles.button} disabled={busy}>{busy?'Creating account…':'Create free account'}</button>
   <p className={styles.muted}>Already registered? <Link href={`/auth${returnTo?'?returnTo='+encodeURIComponent(returnTo):''}#login`}>Sign in</Link>.</p>
  </form>}
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
 </SignupFlow>;
}
