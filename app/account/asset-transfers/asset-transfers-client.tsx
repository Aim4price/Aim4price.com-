'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppHeader from '../../../components/AppHeader';
import styles from './page.module.css';

type TransferStatus = 'pending' | 'claimed' | 'cancelled' | 'expired';
type OutgoingTransfer = {
  id: string;
  assetId: string;
  assetTitle: string;
  assetIdentifier: string;
  assetIdentifierLabel: 'Serial / VIN' | 'Asset ID';
  codeHint: string;
  status: TransferStatus;
  expiresAtIso: string;
  createdAtIso: string;
  claimedAtIso: string | null;
  transferReason: 'sold' | 'traded_in';
  recipientAccountType: 'owner_or_dealer' | 'dealer';
};
type TransferReceipt = {
  id: string;
  assetId: string;
  assetTitle: string;
  assetIdentifier: string;
  assetIdentifierLabel: 'Serial / VIN' | 'Asset ID';
  transferCode: string;
  expiresAtIso: string;
  transferReason: 'sold' | 'traded_in';
  recipientAccountType: 'owner_or_dealer' | 'dealer';
};
type ClaimedTransfer = { assetId: string; assetTitle: string; registerId: string; redirectTo: string };
type TransferResponse = {
  ok?: boolean;
  outgoing?: OutgoingTransfer[];
  transfer?: TransferReceipt;
  claimed?: ClaimedTransfer;
  error?: string;
};

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

const STATUS_LABELS: Record<TransferStatus, string> = {
  pending: 'Waiting for buyer',
  claimed: 'Claimed',
  cancelled: 'Archived',
  expired: 'Code expired',
};

function transferStatusLabel(item: OutgoingTransfer): string {
  if (item.status === 'pending' && item.transferReason === 'traded_in') return 'Waiting for dealer';
  return STATUS_LABELS[item.status];
}

export default function AssetTransfersClient({ context = 'account' }: { context?: 'account' | 'dealer' }) {
  const isDealerContext = context === 'dealer';
  const [outgoing, setOutgoing] = useState<OutgoingTransfer[]>([]);
  const [assetIdentifier, setAssetIdentifier] = useState('');
  const [transferCode, setTransferCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
  const [claimed, setClaimed] = useState<ClaimedTransfer | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState('');

  const pendingCount = useMemo(() => outgoing.filter((item) => item.status === 'pending' || item.status === 'expired').length, [outgoing]);

  async function loadOutgoing() {
    setLoading(true);
    try {
      const response = await fetch('/api/asset-transfers', { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => null) as TransferResponse | null;
      if (response.status === 401) { window.location.assign(isDealerContext ? '/dealer/login' : '/auth#login'); return; }
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Asset transfers could not be loaded.');
      setOutgoing(Array.isArray(payload.outgoing) ? payload.outgoing : []);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Asset transfers could not be loaded.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadOutgoing(); }, []);

  async function post(body: Record<string, unknown>): Promise<TransferResponse> {
    const response = await fetch('/api/asset-transfers', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null) as TransferResponse | null;
    if (response.status === 401) { window.location.assign(isDealerContext ? '/dealer/login' : '/auth#login'); throw new Error('You must be signed in.'); }
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'The transfer could not be completed.');
    return payload;
  }

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction('claim');
    setNotice(null);
    setClaimed(null);
    try {
      const payload = await post({ action: 'claim', assetIdentifier, transferCode });
      if (!payload.claimed) throw new Error('The transfer completed without an asset response.');
      setClaimed(payload.claimed);
      setAssetIdentifier('');
      setTransferCode('');
      setNotice({ tone: 'success', message: `${payload.claimed.assetTitle} is now in your selected ${isDealerContext ? 'dealer inventory register' : 'asset register'}.` });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The asset could not be claimed.' });
    } finally {
      setBusyAction('');
    }
  }

  async function regenerate(transferId: string) {
    setBusyAction(`regenerate:${transferId}`);
    setNotice(null);
    try {
      const payload = await post({ action: 'regenerate', transferId });
      if (!payload.transfer) throw new Error('A new code could not be created.');
      setReceipt(payload.transfer);
      setNotice({ tone: 'success', message: 'A fresh one-time transfer code was created.' });
      await loadOutgoing();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'A new code could not be created.' });
    } finally {
      setBusyAction('');
    }
  }

  async function cancel(transferId: string) {
    if (confirmingCancelId !== transferId) { setConfirmingCancelId(transferId); return; }
    setBusyAction(`cancel:${transferId}`);
    setNotice(null);
    try {
      const payload = await post({ action: 'cancel', transferId });
      setOutgoing(Array.isArray(payload.outgoing) ? payload.outgoing : []);
      setConfirmingCancelId('');
      setNotice({ tone: 'success', message: 'The transfer was cancelled and the asset was archived.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The transfer could not be cancelled.' });
    } finally {
      setBusyAction('');
    }
  }

  async function copyReceipt() {
    if (!receipt) return;
    const message = [
      `Aim4price asset transfer: ${receipt.assetTitle}`,
      `${receipt.assetIdentifierLabel}: ${receipt.assetIdentifier}`,
      `Transfer code: ${receipt.transferCode}`,
      receipt.transferReason === 'traded_in'
        ? 'Open Dealer → My Inventory → Claim asset in Aim4price.'
        : 'Open Account → Asset transfers in Aim4price and choose Claim an asset.',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(message);
      setNotice({ tone: 'success', message: 'Transfer details copied.' });
    } catch {
      setNotice({ tone: 'error', message: 'Copy failed. Select the identifier and code manually.' });
    }
  }

  return (
    <main className={styles.page}>
      {!isDealerContext ? <AppHeader active="none" /> : null}
      <section className={styles.shell}>
        <header className={styles.hero}>
          <div><p>{isDealerContext ? 'Dealer inventory' : 'Account'}</p><h1>{isDealerContext ? 'Inventory transfers' : 'Asset transfers'}</h1><span>{isDealerContext ? 'Accept trade-ins into stock, or manage inventory waiting for its next owner.' : 'Claim an asset you bought, or manage assets waiting for a buyer.'}</span></div>
          <Link href={isDealerContext ? '/dealer/inventory' : '/account'}>{isDealerContext ? 'Back to inventory' : 'Back to account'}</Link>
        </header>

        {notice ? <div className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice}>{notice.message}</div> : null}

        <section className={styles.claimCard} aria-labelledby="claim-asset-title">
          <div className={styles.cardHeader}><p>Incoming</p><h2 id="claim-asset-title">Claim an asset</h2><span>Enter both details exactly as the seller shared them. A code can only be used once.</span></div>
          <form onSubmit={claim} className={styles.claimForm}>
            <label><span>Serial / VIN or Aim4price Asset ID</span><input value={assetIdentifier} onChange={(event) => setAssetIdentifier(event.target.value)} placeholder="Enter the asset identifier" autoComplete="off" required /></label>
            <label><span>Transfer code</span><input value={transferCode} onChange={(event) => setTransferCode(event.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="one-time-code" required /></label>
            <button type="submit" disabled={busyAction === 'claim' || !assetIdentifier.trim() || !transferCode.trim()}>{busyAction === 'claim' ? 'Claiming…' : 'Claim asset'}</button>
          </form>
          <div className={styles.privacyNote}><strong>What you receive</strong><span>Asset details, valuation and maintenance history, scan history, photos and asset documents. The seller’s private invoices, finance, insurance and account access do not transfer.</span></div>
          {claimed ? <div className={styles.claimedCard}><div><strong>{claimed.assetTitle}</strong><span>Transfer complete</span></div><Link href={claimed.redirectTo}>Open asset</Link></div> : null}
        </section>

        <section className={styles.outgoingSection} aria-labelledby="outgoing-transfers-title">
          <div className={styles.sectionHeading}><div><p>Outgoing</p><h2 id="outgoing-transfers-title">Sent assets</h2></div><span>{pendingCount} waiting</span></div>
          {loading ? <div className={styles.emptyState}>Loading transfers…</div> : outgoing.length ? <div className={styles.transferList}>{outgoing.map((item) => (
            <article key={item.id} className={styles.transferCard}>
              <div className={styles.transferTitle}><div><strong>{item.assetTitle}</strong><span>{item.assetIdentifierLabel}: {item.assetIdentifier}</span></div><span className={`${styles.statusBadge} ${styles[`status_${item.status}`]}`}>{transferStatusLabel(item)}</span></div>
              <dl><div><dt>Created</dt><dd>{formatDate(item.createdAtIso)}</dd></div><div><dt>{item.status === 'claimed' ? 'Claimed' : 'Code expiry'}</dt><dd>{formatDate(item.claimedAtIso || item.expiresAtIso)}</dd></div><div><dt>Saved code</dt><dd>Ends in {item.codeHint}</dd></div></dl>
              {(item.status === 'pending' || item.status === 'expired') ? <div className={styles.cardActions}>
                <button type="button" onClick={() => void regenerate(item.id)} disabled={Boolean(busyAction)}>{busyAction === `regenerate:${item.id}` ? 'Creating…' : item.status === 'expired' ? 'Create new code' : 'Replace code'}</button>
                <button type="button" className={styles.archiveButton} onClick={() => void cancel(item.id)} disabled={Boolean(busyAction)}>{busyAction === `cancel:${item.id}` ? 'Archiving…' : confirmingCancelId === item.id ? 'Confirm archive' : 'Cancel & archive'}</button>
              </div> : null}
            </article>
          ))}</div> : <div className={styles.emptyState}><strong>No sent assets yet</strong><span>When you sell or trade in an asset, choose the send option in the asset removal flow.</span></div>}
        </section>
      </section>

      {receipt ? <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="new-transfer-code-title" onClick={() => setReceipt(null)}>
        <section className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
          <header><div><h2 id="new-transfer-code-title">New transfer code</h2><p>Share the identifier and code with the {receipt.transferReason === 'traded_in' ? 'dealer' : 'buyer'}. The previous code no longer works.</p></div><button type="button" onClick={() => setReceipt(null)} aria-label="Close transfer code">×</button></header>
          <div className={styles.receiptGrid}><div><span>{receipt.assetIdentifierLabel}</span><strong>{receipt.assetIdentifier}</strong></div><div><span>Transfer code</span><strong>{receipt.transferCode}</strong></div></div>
          <div className={styles.modalActions}><button type="button" onClick={() => void copyReceipt()}>Copy details</button><button type="button" className={styles.primaryAction} onClick={() => setReceipt(null)}>Done</button></div>
        </section>
      </div> : null}
    </main>
  );
}
