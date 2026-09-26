'use client';
import { useState } from 'react';
import styles from '../page.module.css';
export default function JoinForm() {
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    return <form className={styles.form} onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); const f = new FormData(e.currentTarget); try {
        const r = await fetch('/api/auth/sign-up/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.get('name'), email: f.get('email'), password: f.get('password'), businessName: f.get('businessName'), phone: f.get('phone'), accountType: 'business', accountSubtype: 'contributor', acceptedTerms: f.get('terms') === 'on', callbackURL: '/business' }) }), d = await r.json();
        if (!r.ok)
            throw Error(d.message || 'Unable to create your account.');
        location.assign('/business');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to create your account.');
        setBusy(false);
    } }}>
 <label>Your name<input name="name" required maxLength={150} autoComplete="name"/></label>
 <label>Business name<input name="businessName" required maxLength={200} autoComplete="organization"/></label>
 <label>Email<input name="email" required type="email" autoComplete="email"/></label>
 <label>Contact number<input name="phone" type="tel" maxLength={40} autoComplete="tel"/></label>
 <label>Password<input name="password" required type="password" minLength={8} maxLength={128} autoComplete="new-password"/></label>
 <label className={styles.check}><input name="terms" type="checkbox" required/><span>I accept the <a href="/terms-of-service" target="_blank" rel="noreferrer">terms</a> and <a href="/privacy-policy" target="_blank" rel="noreferrer">privacy policy</a>.</span></label>
 <button disabled={busy} className={styles.button}>{busy ? 'Creating account…' : 'Create free account'}</button>{error && <p role="alert">{error}</p>}
 <p className={styles.muted}>No card or subscription required. Asset management and dealer tools are separate paid services.</p></form>;
}
