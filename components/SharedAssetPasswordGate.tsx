'use client';

import { useEffect, useId, useRef, useState } from 'react';
import landing from '../app/business-network/accept/page.module.css';
import ShareDisclosureDialog from './asset-register/ShareDisclosureDialog';
import styles from './SharedEnquiryLanding.module.css';

export default function SharedAssetPasswordGate({ token, senderName }: { token: string; senderName: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <main className={`${landing.page} ${styles.page}`}>
    <div className={landing.layout}>
      <section className={landing.copy}>
        <h1><span>Asset details.</span><span>Shared with you.</span></h1>
        <p className={landing.sender}><strong>{senderName || 'An Aim4price business'}</strong> has protected this enquiry with a password.</p>
      </section>
      <button type="button" ref={trigger} className={`${landing.action} ${styles.openButton}`} onClick={()=>setOpen(true)}>
        <span className={landing.actionIcon} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M4 9a2 2 0 0 1 2-2h7l3 3h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="m12 21 8-8m-7 0h7v7"/></svg></span>
        <strong>Open enquiry</strong><span className={landing.actionHint}>View the shared asset details</span>
      </button>
    </div>
    {open && <PasswordDialog token={token} onClose={()=>{setOpen(false);trigger.current?.focus();}}/>}
  </main>;
}

function PasswordDialog({token,onClose}: {token:string;onClose:()=>void}) {
  const pending = useRef<AbortController|null>(null);
  useEffect(()=>()=>pending.current?.abort(),[]);
  const titleId = useId();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/asset-share-links/${encodeURIComponent(token)}/password`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The asset link could not be opened.');
      setPassword('');
      if (!controller.signal.aborted) {
        const url = new URL(window.location.href);
        url.searchParams.set('open','1');
        window.location.replace(url.href);
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <ShareDisclosureDialog title="Unlock enquiry" titleId={titleId} descriptionId={`${titleId}-help`} closeLabel="Back to enquiry" onClose={onClose} className={`${styles.dialog} ${styles.passwordDialog}`}>
      <form className={styles.passwordBody} onSubmit={unlock}>
        <div className={styles.passwordSummary}><span className={styles.passwordLock} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span><strong id={`${titleId}-help`}>Use the password from the sender.</strong></div>
        <label className={styles.passwordLabel} htmlFor={`${titleId}-password`}>Link password</label>
        <div className={styles.passwordControl}><input id={`${titleId}-password`} type={showPassword ? 'text' : 'password'} aria-describedby={`${titleId}-hint`} autoComplete="current-password" maxLength={128} value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter the link password" autoFocus/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
        <small id={`${titleId}-hint`}>Passwords are case-sensitive.</small>
        {error && <p className={styles.passwordError} role="alert">{error}</p>}
        <button className={styles.passwordSubmit} type="submit" disabled={busy || !password}>{busy ? 'Checking password…' : 'Unlock enquiry'}</button>
      </form>
    </ShareDisclosureDialog>;
}
