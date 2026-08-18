'use client';

import { useMemo, useState } from 'react';
import type {
  AssistanceAdminAccount,
  AssistanceServiceKey,
} from '../../../lib/assistance-network';
import styles from './page.module.css';

type Props = { initialAccounts: AssistanceAdminAccount[] };

export default function AssistanceNetworkClient({ initialAccounts }: Props) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [pendingKey, setPendingKey] = useState('');
  const [error, setError] = useState('');
  const totals = useMemo(() => ({
    locations: accounts.reduce((sum, account) => sum + account.locations.length, 0),
    enabled: accounts.reduce(
      (sum, account) => sum + account.locations.filter((location) => account.enabled && location.enabled).length,
      0,
    ),
  }), [accounts]);

  async function updateEnabled(input: {
    serviceKey: AssistanceServiceKey;
    locationId?: string;
    enabled: boolean;
  }) {
    const key = input.locationId || input.serviceKey;
    setPendingKey(key);
    setError('');
    try {
      const response = await fetch('/api/admin/assistance-network', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const payload = await response.json() as {
        ok?: boolean;
        error?: string;
        accounts?: AssistanceAdminAccount[];
      };
      if (!response.ok || !payload.ok || !payload.accounts) {
        throw new Error(payload.error || 'Failed to update assistance network.');
      }
      setAccounts(payload.accounts);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update assistance network.');
    } finally {
      setPendingKey('');
    }
  }

  return (
    <>
      <section className={styles.summary} aria-label="Assistance network summary">
        <article><span>Master accounts</span><strong>{accounts.length}</strong><small>No separate login accounts</small></article>
        <article><span>Service locations</span><strong>{totals.locations}</strong><small>Across all five services</small></article>
        <article><span>Visible listings</span><strong>{totals.enabled}</strong><small>Enabled accounts and towns</small></article>
      </section>

      <section className={styles.notice}>
        <strong>System-managed service areas</strong>
        <p>These listings are not physical branches. Disabling a master hides all its locations without deleting records; individual town choices are preserved when it is re-enabled.</p>
      </section>

      {error ? <p role="alert" className={styles.error}>{error}</p> : null}

      <section className={styles.accountList} aria-label="Assistance services">
        {accounts.map((account) => {
          const enabledLocationCount = account.locations.filter((location) => location.enabled).length;
          return (
            <details className={styles.accountCard} key={account.serviceKey} open>
              <summary>
                <div>
                  <span className={styles.badge}>Aim4price managed</span>
                  <h2>{account.displayName}</h2>
                  <p>{account.notificationEmail} · routed to {account.routingEmail}</p>
                </div>
                <span className={styles.townCount}>{enabledLocationCount}/{account.locations.length} towns enabled</span>
              </summary>
              <div className={styles.accountControls}>
                <span>Master assistance account</span>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={account.enabled}
                    disabled={Boolean(pendingKey)}
                    onChange={(event) => updateEnabled({
                      serviceKey: account.serviceKey,
                      enabled: event.target.checked,
                    })}
                  />
                  <span>{pendingKey === account.serviceKey ? 'Saving…' : account.enabled ? 'Service on' : 'Service off'}</span>
                </label>
              </div>
              <div className={styles.locationGrid}>
                {account.locations.map((location) => (
                  <article className={styles.locationRow} key={location.id}>
                    <div>
                      <strong>{location.town}</strong>
                      <span>{location.province} · {location.serviceRadiusKm} km radius</span>
                    </div>
                    <label className={styles.toggle}>
                      <input
                        type="checkbox"
                        checked={location.enabled}
                        disabled={Boolean(pendingKey)}
                        onChange={(event) => updateEnabled({
                          serviceKey: account.serviceKey,
                          locationId: location.id,
                          enabled: event.target.checked,
                        })}
                      />
                      <span>{pendingKey === location.id ? 'Saving…' : location.enabled ? 'Visible' : 'Hidden'}</span>
                    </label>
                  </article>
                ))}
              </div>
            </details>
          );
        })}
      </section>
    </>
  );
}
