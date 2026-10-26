'use client';
import { useState } from 'react';
import styles from './team.module.css';
export default function VerifyTeamEmail({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function send() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/send-verification-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, callbackURL: '/account/team-access' }) });
      if (!response.ok) throw new Error('Unable to send verification email. Please try again.');
      setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send verification email.'); }
    finally { setBusy(false); }
  }
  return <div className={styles.notice}><h2>Verify your email</h2><p>You’re signed in as {email}. Verify this email before managing desktop users.</p>{sent && <p role="status">Verification email sent. Open the link in your email to continue.</p>}{error && <p role="alert">{error}</p>}<div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={() => void send()}>{busy ? 'Sending…' : sent ? 'Resend verification email' : 'Send verification email'}</button>{sent && <button className={styles.button} onClick={() => window.location.reload()}>I’ve verified my email</button>}</div></div>;
}
