'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../business/page.module.css';
export type BusinessVerificationAccount = {
    user_id: string;
    business_name: string;
    phone: string;
    email: string;
    email_verified: boolean;
    account_status: string;
    website: string | null;
    evidence: string | null;
    verified_at: string | null;
    review_note: string | null;
};
export default function ReviewCard({ account: a, onSaved }: {
    account: BusinessVerificationAccount;
    onSaved?: () => void;
}) { const canApprove = a.email_verified && a.account_status === 'active';
 const router = useRouter(), [verified, setVerified] = useState(!!a.verified_at), [note, setNote] = useState(a.review_note || ''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''); return <section className={styles.panel}><p>{a.email} · {a.email_verified ? 'Email verified' : 'Email unverified'} · {a.account_status}</p><p>{a.phone}</p>{a.website && <p>Website/listing: {a.website}</p>}<p>{a.evidence || 'No supporting information supplied.'}</p><form className={styles.form} onSubmit={async (e) => { e.preventDefault(); if (busy) return; setBusy(true); setMessage(''); try {
    const r = await fetch('/api/admin/business-accounts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: a.user_id, verified, note }) }), d = await r.json();
    if (!r.ok)
        throw Error(d.error || 'Unable to save verification. Please try again.');
    setMessage('Verification decision saved.');
    onSaved?.();
    router.refresh();
}
catch (e) {
    setMessage(e instanceof Error ? e.message : 'Unable to save.');
}
finally {
    setBusy(false);
} }}><fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0,display:"grid",gap:"1rem"}}><label className={styles.check}><input type="checkbox" disabled={!canApprove && !verified} checked={verified} onChange={e => setVerified(e.target.checked)}/>Business verified</label>{!canApprove && <p role="note">Approval requires an active account and a verified email. You can still save a review note or remove verification.</p>}<label>Review note<textarea required maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="How did you confirm the business and its contact?"/></label><button disabled={busy || !note.trim() || (verified && !canApprove)} className={styles.button}>{busy ? "Saving…" : "Save verification"}</button></fieldset></form>{message && <p role="status">{message}</p>}</section>; }
