'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../business/page.module.css';
export default function SharingSettings({ initial, accountId }: {
    initial?: Record<string, number | null>;
    accountId?: string;
}) {
    const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
    const router = useRouter();
    return <form className={styles.form} onSubmit={async (event) => {
            event.preventDefault();
            if (busy)
                return;
            setBusy(true);
            setNotice('');
            const form = new FormData(event.currentTarget);
            const body = accountId ? { action: 'activate-desktop', userId: accountId, subscriptionConfirmed: form.get('confirmed') === 'on' } : { action: 'allowances', ...Object.fromEntries(['assets', 'uploads', 'interactions', 'emails'].map(key => [key, form.get(key) === '' ? null : Number(form.get(key))])) };
            try {
                const response = await fetch('/api/admin/sharing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const result = await response.json();
                if (!response.ok)
                    throw Error(result.error);
                setNotice('Saved.');
                router.refresh();
            }
            catch (e) {
                setNotice((e as Error).message);
            }
            finally {
                setBusy(false);
            }
        }}>
  {accountId ? <label className={styles.check}><input type="checkbox" name="confirmed" required/> Subscription arranged; activate Dealer Desktop on this same account.</label> : <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>{['assets', 'uploads', 'interactions', 'emails'].map(key => <label key={key}>{key}<input aria-label={key} name={key} type="number" min={0} max={1000000} defaultValue={initial?.[key] ?? ''}/></label>)}</div>}
  <button className={styles.button} disabled={busy} type="submit">{busy ? 'Saving…' : accountId ? 'Activate Desktop' : 'Save draft allowances'}</button>{notice && <p role="status">{notice}</p>}
 </form>;
}
