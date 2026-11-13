'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './page.module.css';

type SetupAccount = {
  id: string;
  email: string;
  accountType: string;
  sharingPlan: string;
};

export default function AccountSetup() {
  const [account, setAccount] = useState<SetupAccount | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'signed-out' | 'ready' | 'error'>('idle');
  const [copyMessage, setCopyMessage] = useState('');

  async function checkAccount() {
    setStatus('loading');
    setAccount(null);
    setCopyMessage('');
    try {
      const response = await fetch('/api/me?scope=website', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'x-aim4price-client-realm': 'website' },
      });
      if (!response.ok) throw new Error('Account lookup failed');
      const result = await response.json();
      if (result.signedIn === false) {
        setStatus('signed-out');
        return;
      }
      const user = result.user;
      if (result.signedIn !== true || !user ||
        !['id', 'email', 'accountType', 'sharingPlan'].every(key => typeof user[key] === 'string' && user[key])) {
        throw new Error('Account details unavailable');
      }
      // Explicit fields only: never copy a session, token, or the full API response.
      setAccount({ id: user.id, email: user.email, accountType: user.accountType, sharingPlan: user.sharingPlan });
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  async function copyAccount() {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(account, null, 2));
      setCopyMessage('Account details copied.');
    } catch {
      setCopyMessage('Copy is unavailable in this browser. Open “View account details” to select and copy them manually.');
    }
  }

  return (
    <div className={styles.accountSetup}>
      <div className={styles.setupHeading}>
        <div><strong>Start with your Aim4price account</strong><p>Check which account you’re signed into for connection setup.</p></div>
        <button type="button" onClick={checkAccount} disabled={status === 'loading'} aria-expanded={status !== 'idle'} aria-controls="connection-account-details">
          {status === 'loading' ? 'Checking…' : status === 'idle' ? 'Check my account' : 'Check again'}
        </button>
      </div>
      <div id="connection-account-details" aria-live="polite" aria-busy={status === 'loading'}>
        {status === 'signed-out' && <div className={styles.setupResult}>
          <strong>Sign in to continue</strong>
          <p>No Aim4price website sign-in was found. Sign in to your Aim4price account, then return here to check it.</p>
          <Link className={styles.primary} href="/auth?accountAccess=desktop&returnTo=%2Faccount%2Fai-connect#login">Sign in to Aim4price →</Link>
        </div>}
        {status === 'error' && <p role="alert">We couldn’t check your account. Please try again.</p>}
        {account && <div className={styles.setupResult}>
          <strong>{account.email}</strong>
          <p>These details identify your account for setup. Eligibility is checked separately when you approve access.</p>
          <details className={styles.accountDetails}><summary>View account details</summary>
            <dl>{Object.entries(account).map(([key, value]) => <div key={key}><dt>{({ id: 'Account ID', email: 'Email', accountType: 'Account type', sharingPlan: 'Access plan' } as Record<string, string>)[key]}</dt><dd>{value}</dd></div>)}</dl>
          </details>
          <button type="button" onClick={copyAccount}>Copy account details</button>
          <p className={styles.note}>Share these details with the Aim4price Admin helping with setup. They contain no password or access token.</p>
          {copyMessage && <p role="status">{copyMessage}</p>}
        </div>}
      </div>
    </div>
  );
}
