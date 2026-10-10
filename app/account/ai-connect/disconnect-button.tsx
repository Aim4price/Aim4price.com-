'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function DisconnectButton({ id, audience = 'owner' }: { id: string; audience?: 'owner' | 'admin' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const response = await fetch('/api/ai/connections?audience=' + audience, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'x-aim4price-client-realm': 'website',
              },
              body: JSON.stringify({ id }),
            });
            if (!response.ok)
              throw new Error('Could not disconnect. Please try again.');
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Please try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Disconnecting…' : 'Disconnect'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
