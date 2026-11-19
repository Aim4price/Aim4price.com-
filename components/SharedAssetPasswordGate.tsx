'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import ShareDisclosureDialog from './asset-register/ShareDisclosureDialog';
import styles from './SharedEnquiryLanding.module.css';

export default function SharedAssetPasswordGate({ token }: { token: string }) {
  const router = useRouter();
  const titleId = useId();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/asset-share-links/${encodeURIComponent(token)}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The asset link could not be opened.');
      setPassword('');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className={`${styles.page} ${styles.passwordPage}`}>
    <div className={styles.layout}><section className={styles.copy}>
      <h1><span>Asset details.</span><span>Shared with you.</span></h1>
      <p>Enter the password shared by the sender to open this asset link.</p>
    </section></div>
    <ShareDisclosureDialog title="Open shared asset" titleId={titleId} closeLabel="Return to Aim4price" onClose={() => { window.location.assign('/'); }} className={styles.dialog}>
      <form className={styles.passwordBody} onSubmit={unlock}>
        <div className={styles.passwordSummary}><span className={styles.passwordLock} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span><div><strong>Password protected link</strong><span>Only people with the password can open the shared assets.</span></div></div>
        <label className={styles.passwordLabel} htmlFor={`${titleId}-password`}>Link password</label>
        <div className={styles.passwordControl}><input id={`${titleId}-password`} type={showPassword ? 'text' : 'password'} autoComplete="current-password" maxLength={128} value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter the link password" autoFocus/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
        <small>Passwords are case-sensitive.</small>
        {error && <p className={styles.passwordError} role="alert">{error}</p>}
        <button className={styles.passwordSubmit} type="submit" disabled={busy || !password}>{busy ? 'Checking password…' : 'Open shared asset'}</button>
      </form>
    </ShareDisclosureDialog>
  </main>;
}
