'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import AppHeader from '../../../components/AppHeader';
import wizardStyles from '../../../components/AimWizardModal.module.css';
import launcherStyles from '../app-access-management.module.css';
import styles from './page.module.css';

type TransferStatus = 'pending' | 'claimed' | 'cancelled' | 'expired';
type ActiveFlow = 'incoming' | 'outgoing' | null;
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

function manageableOutgoing(items: OutgoingTransfer[] | undefined): OutgoingTransfer[] {
  return Array.isArray(items)
    ? items.filter((item) => item.status === 'pending' || item.status === 'expired')
    : [];
}

function IncomingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M12 3v11m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
    </svg>
  );
}

function OutgoingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M12 15V4m0 0 4 4m-4-4L8 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3 5.5 5.7v5.6c0 4.1 2.6 7.6 6.5 9.7 3.9-2.1 6.5-5.6 6.5-9.7V5.7L12 3Z" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" />
    </svg>
  );
}

function TransferProgress({
  currentStep,
  labels,
}: {
  currentStep: 1 | 2;
  labels: readonly [string, string];
}) {
  return (
    <ol className={`${wizardStyles.progress} ${styles.transferProgress}`} aria-label="Transfer progress">
      {labels.map((label, index) => {
        const step = (index + 1) as 1 | 2;
        const stateClass = step < currentStep
          ? wizardStyles.progressItemComplete
          : step === currentStep
            ? wizardStyles.progressItemCurrent
            : '';
        return (
          <li key={label} className={`${wizardStyles.progressItem} ${stateClass}`} aria-current={step === currentStep ? 'step' : undefined}>
            <span>{step < currentStep ? '✓' : step}</span>
            <strong>{label}</strong>
          </li>
        );
      })}
    </ol>
  );
}

function TransferModal({
  open,
  title,
  description,
  closeDisabled = false,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description: string;
  closeDisabled?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const modalRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  const titleId = 'asset-transfer-modal-title';
  const descriptionId = 'asset-transfer-modal-description';
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      const initialFocus = modalRef.current?.querySelector<HTMLElement>('[data-modal-initial-focus]');
      (initialFocus || closeRef.current)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !closeDisabledRef.current) onCloseRef.current();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={wizardStyles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !closeDisabled) onClose(); }}>
      <section ref={modalRef} className={wizardStyles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <header className={wizardStyles.header}>
          <div className={wizardStyles.headerText}>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <button ref={closeRef} type="button" className={wizardStyles.closeButton} onClick={onClose} disabled={closeDisabled} aria-label="Close dialog"><CloseIcon /></button>
        </header>
        <div className={wizardStyles.body}>{children}</div>
        {footer ? <footer className={wizardStyles.footer}>{footer}</footer> : null}
      </section>
    </div>
  );
}

export default function AssetTransfersClient({ context = 'account' }: { context?: 'account' | 'dealer' }) {
  const isDealerContext = context === 'dealer';
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
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
  const cancelTransfer = useMemo(() => outgoing.find((item) => item.id === confirmingCancelId) || null, [confirmingCancelId, outgoing]);

  async function loadOutgoing() {
    setLoading(true);
    try {
      const response = await fetch('/api/asset-transfers', { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => null) as TransferResponse | null;
      if (response.status === 401) { window.location.assign(isDealerContext ? '/dealer/login' : '/auth#login'); return; }
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Asset transfers could not be loaded.');
      setOutgoing(manageableOutgoing(payload.outgoing));
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

  function openFlow(flow: Exclude<ActiveFlow, null>) {
    setActiveFlow(flow);
    setReceipt(null);
    setClaimed(null);
    setConfirmingCancelId('');
    setNotice(null);
    if (flow === 'outgoing' && !loading && !outgoing.length) void loadOutgoing();
  }

  function closeFlow() {
    if (busyAction) return;
    setActiveFlow(null);
    setReceipt(null);
    setClaimed(null);
    setConfirmingCancelId('');
    setNotice(null);
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
    setBusyAction(`cancel:${transferId}`);
    setNotice(null);
    try {
      const payload = await post({ action: 'cancel', transferId });
      setOutgoing(manageableOutgoing(payload.outgoing).filter((item) => item.id !== transferId));
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
        : 'Open Account → Asset transfers in Aim4price and choose Incoming.',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(message);
      setNotice({ tone: 'success', message: 'Transfer details copied.' });
    } catch {
      setNotice({ tone: 'error', message: 'Copy failed. Select the identifier and code manually.' });
    }
  }

  const outgoingModalTitle = receipt ? 'New transfer code' : cancelTransfer ? 'Cancel outgoing transfer?' : 'Outgoing assets';
  const outgoingModalDescription = receipt
    ? `Share these details with the ${receipt.transferReason === 'traded_in' ? 'dealer' : 'buyer'}. The previous code no longer works.`
    : cancelTransfer
      ? 'Review the asset before cancelling its one-time transfer code.'
      : 'Manage assets waiting for a buyer or dealer.';

  return (
    <main className={styles.page}>
      {!isDealerContext ? <AppHeader active="none" /> : null}
      <section className={styles.shell}>
        <Link className={styles.backButton} href={isDealerContext ? '/dealer/inventory' : '/account'}>← {isDealerContext ? 'Back to inventory' : 'Back to account'}</Link>

        <section className={`${launcherStyles.launcher} ${styles.transferLauncher}`} aria-labelledby="asset-transfers-title">
          <div className={launcherStyles.launcherIntro}>
            <h1 id="asset-transfers-title">{isDealerContext ? 'Inventory transfers' : 'Asset transfers'}</h1>
            <p>{isDealerContext ? 'Bring trade-ins into stock or manage inventory moving to its next owner.' : 'Bring an asset into your register or manage one moving to its next owner.'}</p>
          </div>

          <div className={launcherStyles.actionGrid} aria-label="Choose an asset transfer direction">
            <button type="button" className={`${launcherStyles.actionButton} ${launcherStyles.actionButtonNew}`} onClick={() => openFlow('incoming')}>
              <span className={launcherStyles.actionIcon}><IncomingIcon /></span>
              <span className={launcherStyles.actionCopy}>
                <strong>Incoming</strong>
                <small>{isDealerContext ? 'Claim a trade-in into dealer inventory.' : 'Claim an asset into this account.'}</small>
              </span>
              <span className={launcherStyles.actionMeta}><span className={launcherStyles.actionArrow} aria-hidden="true">›</span></span>
            </button>

            <button type="button" className={`${launcherStyles.actionButton} ${launcherStyles.actionButtonManage}`} onClick={() => openFlow('outgoing')}>
              <span className={launcherStyles.actionIcon}><OutgoingIcon /></span>
              <span className={launcherStyles.actionCopy}>
                <strong>Outgoing</strong>
                <small>Manage sent assets and one-time codes.</small>
              </span>
              <span className={launcherStyles.actionMeta}>
                <span className={launcherStyles.countPill}>{loading ? '…' : outgoing.length}</span>
                <span className={launcherStyles.actionArrow} aria-hidden="true">›</span>
              </span>
            </button>
          </div>

          <div className={styles.transferGuide}>
            <span className={styles.guideIcon}><ShieldIcon /></span>
            <div><strong>Only the portable asset record moves</strong><p>Asset details, valuation, maintenance, scans, photos and saved asset documents can move. Private invoices, finance, insurance and account access stay with the source account.</p></div>
          </div>
        </section>

        {notice && !activeFlow ? <div className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</div> : null}
      </section>

      <TransferModal
        open={activeFlow === 'incoming'}
        title="Incoming asset"
        description={isDealerContext ? 'Claim a trade-in into your selected dealer inventory register.' : 'Claim an asset into your selected Asset Register.'}
        closeDisabled={Boolean(busyAction)}
        onClose={closeFlow}
        footer={claimed ? <>
          <button type="button" className={wizardStyles.secondaryAction} onClick={() => { setClaimed(null); setNotice(null); }}>Claim another asset</button>
          <Link className={`${wizardStyles.primaryAction} ${styles.footerLink}`} href={claimed.redirectTo}>Open asset</Link>
        </> : <>
          <button type="button" className={wizardStyles.secondaryAction} onClick={closeFlow} disabled={Boolean(busyAction)}>Cancel</button>
          <button type="submit" form="asset-transfer-claim-form" className={wizardStyles.primaryAction} disabled={busyAction === 'claim' || !assetIdentifier.trim() || !transferCode.trim()}>{busyAction === 'claim' ? 'Claiming asset…' : 'Claim asset'}</button>
        </>}
      >
        <p className={wizardStyles.intro}>Enter the shared transfer details first. The asset is saved to your selected register only after the code is verified.</p>
        <TransferProgress currentStep={claimed ? 2 : 1} labels={['Transfer details', 'Asset received']} />
        {notice ? <div className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</div> : null}
        {claimed ? <section className={wizardStyles.panel}>
          <div className={wizardStyles.panelHeading}>
            <span className={wizardStyles.panelNumber}>2</span>
            <h3>Asset received</h3>
            <p>The ownership transfer is complete.</p>
          </div>
          <div className={styles.claimResult}>
            <span className={styles.resultIcon}>✓</span>
            <div><h3>{claimed.assetTitle}</h3><p>The asset is ready in your selected {isDealerContext ? 'dealer inventory register' : 'Asset Register'}.</p></div>
          </div>
        </section> : <section className={wizardStyles.panel}>
          <div className={wizardStyles.panelHeading}>
            <span className={wizardStyles.panelNumber}>1</span>
            <h3>Enter the transfer details</h3>
            <p>Use the identifier and one-time code exactly as the sender shared them.</p>
          </div>
          <form id="asset-transfer-claim-form" onSubmit={claim} className={styles.claimForm}>
            <label><span>Serial / VIN or Aim4price Asset ID</span><input data-modal-initial-focus value={assetIdentifier} onChange={(event) => setAssetIdentifier(event.target.value)} placeholder="Enter the asset identifier" autoComplete="off" required /></label>
            <label><span>Transfer code</span><input value={transferCode} onChange={(event) => setTransferCode(event.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="one-time-code" required /></label>
          </form>
          <div className={styles.privacyNote}><strong>What arrives with the asset</strong><span>Asset details, valuation and maintenance history, scan history, photos and saved asset documents. The sender’s private invoices, finance, insurance and account access do not transfer.</span></div>
        </section>}
      </TransferModal>

      <TransferModal
        open={activeFlow === 'outgoing'}
        title={outgoingModalTitle}
        description={outgoingModalDescription}
        closeDisabled={Boolean(busyAction)}
        onClose={closeFlow}
        footer={receipt ? <>
          <button type="button" className={wizardStyles.secondaryAction} onClick={() => { setReceipt(null); setNotice(null); }}>Back to outgoing</button>
          <button type="button" className={wizardStyles.primaryAction} onClick={() => void copyReceipt()}>Copy details</button>
        </> : cancelTransfer ? <>
          <button type="button" className={wizardStyles.secondaryAction} onClick={() => { setConfirmingCancelId(''); setNotice(null); }} disabled={Boolean(busyAction)}>Keep transfer</button>
          <button type="button" className={`${wizardStyles.primaryAction} ${styles.footerDangerAction}`} onClick={() => void cancel(cancelTransfer.id)} disabled={Boolean(busyAction)}>{busyAction === `cancel:${cancelTransfer.id}` ? 'Archiving asset…' : 'Cancel & archive'}</button>
        </> : <button type="button" className={`${wizardStyles.primaryAction} ${styles.footerOnlyAction}`} onClick={closeFlow}>Done</button>}
      >
        <p className={wizardStyles.intro}>Review the assets still waiting to transfer, then manage one code at a time.</p>
        <TransferProgress currentStep={receipt || cancelTransfer ? 2 : 1} labels={['Pending assets', 'Transfer action']} />
        {notice ? <div className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</div> : null}
        {receipt ? <section className={wizardStyles.panel}>
          <div className={wizardStyles.panelHeading}>
            <span className={wizardStyles.panelNumber}>2</span>
            <h3>{receipt.assetTitle}</h3>
            <p>Copy and send both details. This code can only be used once.</p>
          </div>
          <div className={styles.receiptGrid}><div><span>{receipt.assetIdentifierLabel}</span><strong>{receipt.assetIdentifier}</strong></div><div><span>Transfer code</span><strong>{receipt.transferCode}</strong></div></div>
        </section> : cancelTransfer ? <section className={`${wizardStyles.panel} ${styles.cancelPanel}`}>
          <div className={wizardStyles.panelHeading}>
            <span className={`${wizardStyles.panelNumber} ${styles.cancelPanelNumber}`}>2</span>
            <h3>{cancelTransfer.assetTitle}</h3>
            <p>The current one-time code will stop working and the asset will remain archived. This does not return it to the active register.</p>
          </div>
          <dl className={styles.cancelDetails}><div><dt>{cancelTransfer.assetIdentifierLabel}</dt><dd>{cancelTransfer.assetIdentifier}</dd></div><div><dt>Current status</dt><dd>{transferStatusLabel(cancelTransfer)}</dd></div></dl>
        </section> : <section className={wizardStyles.panel}>
          <div className={styles.outgoingHeading}>
            <div className={wizardStyles.panelHeading}>
              <span className={wizardStyles.panelNumber}>1</span>
              <h3>Sent assets</h3>
              <p>Select a pending transfer to replace its code or cancel and archive it.</p>
            </div>
            <span>{pendingCount} waiting</span>
          </div>
          {loading ? <div className={styles.emptyState}>Loading transfers…</div> : outgoing.length ? <div className={styles.transferList}>{outgoing.map((item) => (
            <article key={item.id} className={styles.transferCard}>
              <div className={styles.transferTitle}><div><strong>{item.assetTitle}</strong><span>{item.assetIdentifierLabel}: {item.assetIdentifier}</span></div><span className={`${styles.statusBadge} ${styles[`status_${item.status}`]}`}>{transferStatusLabel(item)}</span></div>
              <dl><div><dt>Created</dt><dd>{formatDate(item.createdAtIso)}</dd></div><div><dt>Code expiry</dt><dd>{formatDate(item.expiresAtIso)}</dd></div><div><dt>Saved code</dt><dd>Ends in {item.codeHint}</dd></div></dl>
              <div className={styles.cardActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => void regenerate(item.id)} disabled={Boolean(busyAction)}>{busyAction === `regenerate:${item.id}` ? 'Creating code…' : item.status === 'expired' ? 'Create new code' : 'Replace code'}</button>
                <button type="button" className={styles.archiveButton} onClick={() => { setConfirmingCancelId(item.id); setNotice(null); }} disabled={Boolean(busyAction)}>Cancel & archive</button>
              </div>
            </article>
          ))}</div> : <div className={styles.emptyState}><strong>No pending outgoing assets</strong><span>Cancelled, claimed and archived transfers are removed from this list.</span></div>}
        </section>}
      </TransferModal>
    </main>
  );
}
