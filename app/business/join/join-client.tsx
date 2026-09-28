'use client';
import { useState } from 'react';
import styles from '../page.module.css';
export default function JoinForm({returnTo,email}:{returnTo?:string|null;email?:string}) {
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [createdEmail,setCreatedEmail]=useState(''),[sent,setSent]=useState(false);
    async function sendVerification(address:string){
      const r=await fetch('/api/auth/send-verification-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:address,callbackURL:returnTo||'/business'})});
      if(!r.ok)throw Error('Your account was created, but the verification email could not be sent. Please resend it.');
      setSent(true);
    }
    if(createdEmail)return <div className={styles.form}><h2>Check your email</h2><p className={styles.muted}>{sent?'We sent a verification link to':'Your account is registered with'} {createdEmail}. {returnTo?'Verify your email, then return to this enquiry.':'Verify your email to continue.'}</p><button type="button" className={styles.button} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await sendVerification(createdEmail);}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}}>{busy?'Sending…':'Resend verification email'}</button><a className={styles.button} href={returnTo||'/business'}>Continue</a>{error&&<p role="alert">{error}</p>}</div>;
    return <form className={styles.form} onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); const f = new FormData(e.currentTarget); try {
        const r = await fetch('/api/auth/sign-up/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.get('name'), email: f.get('email'), password: f.get('password'), businessName: f.get('businessName'), phone: f.get('phone'), accountType: 'business', accountSubtype: f.get('accountSubtype'), acceptedTerms: f.get('terms') === 'on', callbackURL: returnTo||'/business' }) }), d = await r.json();
        if (!r.ok)
            throw Error(d.message || 'Unable to create your account.');
        const address=String(f.get('email')||'');setCreatedEmail(address);
        await sendVerification(address);
        setBusy(false);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to create your account.');
        setBusy(false);
    } }}>
 <label>Your name<input name="name" required maxLength={150} autoComplete="name"/></label>
 <label>Business name<input name="businessName" required maxLength={200} autoComplete="organization"/></label>
 <label>Business type<select name="accountSubtype" required defaultValue="">
  <option value="" disabled>Select your business type</option>
  <option value="insurance-services">Insurance</option>
  <option value="finance-services">Finance</option>
  <option value="licensing-services">Licensing</option>
  <option value="accounting-services">Accounting / asset advice</option>
  <option value="maintenance-services">Repairs / maintenance</option>
  <option value="contributor">Other business</option>
 </select></label>
 <p className={styles.muted}>All business types use the same Basic account: Home, Get Estimate, Leads and Marketplace.</p>
 <label>Email<input name="email" defaultValue={email} required type="email" autoComplete="email"/></label>
 <label>Contact number<input name="phone" type="tel" maxLength={40} autoComplete="tel"/></label>
 <label>Password<input name="password" required type="password" minLength={8} maxLength={128} autoComplete="new-password"/></label>
 <label className={styles.check}><input name="terms" type="checkbox" required/><span>I accept the <a href="/terms-of-service" target="_blank" rel="noreferrer">terms</a> and <a href="/privacy-policy" target="_blank" rel="noreferrer">privacy policy</a>.</span></label>
 <p className={styles.muted}>Business pricing: R199/month. Creating an account does not take a payment.</p>
 <button disabled={busy} className={styles.button}>{busy ? 'Creating account…' : 'Create Business account'}</button>{error && <p role="alert">{error}</p>}
 <p className={styles.muted}>For finance, insurance, licensing and other asset services.</p></form>;
}
