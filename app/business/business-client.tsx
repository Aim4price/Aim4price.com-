'use client';
import SwitchAccountButton from '../../components/SwitchAccountButton';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
export function SignOut() { return <SwitchAccountButton />; }
export default function BusinessDetails({ businessName, phone, website, evidence, email, emailVerified, returnTo }: {
    businessName: string;
    phone: string;
    website: string;
    evidence: string;
    email: string;
    emailVerified: boolean;
    returnTo?: string|null;
}) {
    const router = useRouter(), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
    return <><div className={styles.identityBar}><div><small>Signed in as</small><strong>{email}</strong></div><span className={emailVerified ? styles.verifiedBadge : styles.pendingBadge}>{emailVerified ? 'Email verified' : 'Email verification needed'}</span></div>
 {!emailVerified && <button className={styles.button} disabled={busy} onClick={async () => { setBusy(true); try {
        const r = await fetch('/api/auth/send-verification-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, callbackURL: returnTo||'/business' }) });
        if (!r.ok)
            throw Error();
        setNotice('Check your inbox for the verification link.');
    }
    catch {
        setNotice('Unable to send the verification email. Please try again.');
    }
    finally {
        setBusy(false);
    } }}>Verify email</button>}
 <form className={`${styles.form} ${styles.businessForm}`} onSubmit={async (e) => { e.preventDefault(); const body = Object.fromEntries(new FormData(e.currentTarget)); setBusy(true); try {
        const r = await fetch('/api/business-account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), d = await r.json();
        if (!r.ok)
            throw Error(d.error);
        setNotice('Details saved. Changed details require Admin review.');
        router.refresh();
    }
    catch (e) {
        setNotice(e instanceof Error ? e.message : 'Unable to save.');
    }
    finally {
        setBusy(false);
    } }}>
 <label>Business name<input name="businessName" required maxLength={200} defaultValue={businessName}/></label>
 <label>Contact number<input name="phone" type="tel" maxLength={40} defaultValue={phone}/></label>
 <label>Website or business listing<input name="website" type="url" maxLength={500} defaultValue={website} placeholder="https://"/></label>
 <label className={styles.evidenceField}>Information for verification<textarea name="evidence" maxLength={2000} defaultValue={evidence} placeholder="Tell Aim4price about your business and how we can confirm it."/></label>
 <div className={styles.formFooter}><p className={styles.muted}>No online listing? Tell us how to confirm your business. Changed details are reviewed by Aim4price.</p><button className={styles.button} disabled={busy}>{busy ? 'Saving…' : 'Save details'}</button></div>
 </form>{notice && <p className={styles.notice} role="status">{notice}</p>}</>;
}
