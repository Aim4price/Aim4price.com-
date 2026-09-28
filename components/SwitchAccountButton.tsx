'use client';

import { useState } from 'react';
import { switchWebsiteAccount } from '../lib/switch-website-account';
import styles from './SwitchAccountButton.module.css';

export default function SwitchAccountButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function switchAccount() {
    setBusy(true);
    setError('');
    try { await switchWebsiteAccount(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out. Please try again.');
      setBusy(false);
    }
  }
  return <div className={styles.action}>
    <button type="button" className={styles.button} disabled={busy} onClick={() => void switchAccount()}>
      {busy ? 'Signing out…' : 'Sign in to another account'}
    </button>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
}
