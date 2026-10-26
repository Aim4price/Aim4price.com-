'use client';
import Link from 'next/link';
import { useState } from 'react';
import styles from './team.module.css';
export default function TeamLogin({ business }: { business: string }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/team-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business, email, password }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Unable to sign in.');
      window.location.assign('/team');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}><h1>Desktop sign in</h1><p>Use the email and password supplied by your business owner.</p>{business ? <form className={styles.card} onSubmit={login}><div className={styles.fields}><label className={styles.field}>Email address<input className={styles.input} type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label><label className={styles.field}>Password<input className={styles.input} type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => setPassword(e.target.value)}/></label></div>{error && <p className={styles.error} role="alert">{error}</p>}<p className={styles.muted}>Forgot your password? Ask your business owner to reset your desktop login.</p><button className={styles.primary} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form> : <p className={styles.notice}>Open the business sign-in link supplied by your owner to use a separate desktop login.</p>}<p>Already have an Aim4price account?</p><Link className={styles.button} href="/auth?returnTo=/team">Use my existing account</Link></main>;
}
