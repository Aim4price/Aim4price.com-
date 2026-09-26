'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
export function SignOut() { return <button className={styles.button} onClick={async () => { const r = await fetch('/api/auth/sign-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (r.ok)
    location.assign('/auth#login'); }}>Sign out</button>; }
export default function BusinessDetails({ businessName, phone, website, evidence, email, emailVerified }: {
    businessName: string;
    phone: string;
    website: string;
    evidence: string;
    email: string;
    emailVerified: boolean;
}) {
    const router = useRouter(), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
    return <><p className={styles.muted}>Signed in as {email}. {emailVerified ? 'Email verified.' : 'Verify your email before Admin can approve your business.'}</p>
 {!emailVerified && <button className={styles.button} disabled={busy} onClick={async () => { setBusy(true); try {
        const r = await fetch('/api/auth/send-verification-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, callbackURL: '/business' }) });
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
 <form className={styles.form} onSubmit={async (e) => { e.preventDefault(); const body = Object.fromEntries(new FormData(e.currentTarget)); setBusy(true); try {
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
 <label>Information for verification<textarea name="evidence" maxLength={2000} defaultValue={evidence} placeholder="Tell Aim4price about your business and how we can confirm it."/></label>
 <p className={styles.muted}>No online listing? Aim4price will contact you for supporting information. Updating these details sends your business for review again.</p>
 <button className={styles.button} disabled={busy}>Save business details</button>
 </form>{notice && <p className={styles.notice} role="status">{notice}</p>}</>;
}
