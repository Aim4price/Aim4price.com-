'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import DealerCostDecisionModal from '../../../components/DealerCostDecisionModal';
import styles from '../owner-app.module.css';

type NotificationTone = 'neutral' | 'success' | 'warning' | 'info';
type NotificationState = 'needs_action' | 'new' | 'history';
type NotificationView = 'active' | 'history';
type InboxAction = 'mark_read' | 'archive' | 'resolve';
type NotificationCategoryFilter = 'all' | 'maintenance' | 'costs' | 'leads' | 'notes' | 'fuel' | 'assets' | 'discovery';

type Notification = {
  id: string;
  category: string;
  tone: NotificationTone;
  title: string;
  body: string;
  href: string;
  createdAtIso: string;
  assetId?: string;
  assetDiscoveryEnquiryId?: string;
  dealerAssetCorrectionId?: string;
  dealerAssetCorrectionAction?: 'decision' | 'retry' | 'pending';
  dealerMaintenanceScheduleProposalId?: string;
  dealerCostInvoiceId?: string;
  dealerCostAction?: 'store' | 'delete';
  captureRequestId?: string;
  priority?: boolean;
  state: NotificationState;
  actionRequired: boolean;
  isRead: boolean;
  isArchived: boolean;
  readAtIso: string | null;
  archivedAtIso: string | null;
  resolvedAtIso: string | null;
};

type NotificationsResponse = {
  ok?: boolean;
  notifications?: Notification[];
  error?: string;
};

const CATEGORY_FILTERS: Array<{ value: NotificationCategoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'costs', label: 'Costs' },
  { value: 'leads', label: 'Leads' },
  { value: 'notes', label: 'Notes' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'assets', label: 'Assets' },
  { value: 'discovery', label: 'Discovery' },
];

function destination(item: Notification): string {
  if (item.href.startsWith('/owner-app/')) return item.href;
  if (item.category === 'capture' && item.href) return item.href;
  if (item.assetId) return `/owner-app/assets/${encodeURIComponent(item.assetId)}`;
  if (item.category === 'partner_note' || item.category === 'lead' || item.category === 'asset_discovery') {
    return '/owner-app/marketplace';
  }
  return '/owner-app/assets';
}

function formatNotificationTime(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';

  const difference = Date.now() - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (difference < minute) return 'Just now';
  if (difference < hour) return `${Math.max(1, Math.round(difference / minute))} min ago`;
  if (difference < day) return `${Math.max(1, Math.round(difference / hour))} hr ago`;
  if (difference < 7 * day) return `${Math.max(1, Math.round(difference / day))} days ago`;

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

function matchesCategory(item: Notification, filter: NotificationCategoryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'maintenance') return item.category === 'maintenance' || item.category === 'dealer_schedule';
  if (filter === 'costs') return item.category === 'dealer_cost' || item.category === 'capture';
  if (filter === 'leads') return item.category === 'lead';
  if (filter === 'notes') return item.category === 'partner_note';
  if (filter === 'fuel') return item.category === 'fuel';
  if (filter === 'discovery') return item.category === 'asset_discovery';
  return item.category === 'qr_scan' || item.category === 'dealer_correction';
}

async function updateInboxState(action: InboxAction, notificationIds: string[]): Promise<void> {
  if (!notificationIds.length) return;

  const response = await fetch('/api/owner-app/notifications', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, notificationIds }),
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Could not update notifications.');
  }
}

export default function OwnerNotificationsClient({ viewerId: _viewerId }: { viewerId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [activeView, setActiveView] = useState<NotificationView>('active');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [updatingInbox, setUpdatingInbox] = useState(false);
  const [error, setError] = useState('');
  const [outcomeNotice, setOutcomeNotice] = useState<{
    tone: 'success' | 'warning';
    message: string;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [processingCorrectionIds, setProcessingCorrectionIds] = useState<Set<string>>(() => new Set());
  const [processingScheduleProposalIds, setProcessingScheduleProposalIds] = useState<Set<string>>(() => new Set());
  const [activeDealerCostInvoiceId, setActiveDealerCostInvoiceId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const initialViewAppliedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      if (!hasLoadedRef.current) setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/owner-app/notifications', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as NotificationsResponse | null;

        if (response.status === 401) {
          window.location.replace('/owner-app/login');
          return;
        }
        if (!response.ok || !payload?.ok || !Array.isArray(payload.notifications)) {
          throw new Error(payload?.error || 'Failed to load notifications.');
        }

        setItems(payload.notifications);
        if (!initialViewAppliedRef.current) {
          initialViewAppliedRef.current = true;
          setActiveView(payload.notifications.some((item) => item.state !== 'history') ? 'active' : 'history');
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Failed to load notifications.');
      } finally {
        if (!controller.signal.aborted) {
          hasLoadedRef.current = true;
          setLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [reloadToken]);

  useEffect(() => {
    const reload = () => setReloadToken((current) => current + 1);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    const intervalId = window.setInterval(reload, 30_000);
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const counts = useMemo(() => ({
    active: items.filter((item) => item.state !== 'history').length,
    new: items.filter((item) => item.state === 'new').length,
    history: items.filter((item) => item.state === 'history').length,
  }), [items]);

  const visibleItems = useMemo(() => items.filter((item) => {
    const isActive = item.state !== 'history';
    if (activeView === 'active' ? !isActive : isActive) return false;
    return matchesCategory(item, categoryFilter);
  }), [activeView, categoryFilter, items]);

  async function changeNotificationState(action: InboxAction, notificationIds: string[]) {
    if (!notificationIds.length) return;
    setUpdatingInbox(true);
    setError('');

    try {
      await updateInboxState(action, notificationIds);
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => {
        if (!notificationIds.includes(item.id)) return item;
        if (action === 'resolve') {
          return { ...item, state: 'history', isRead: true, readAtIso: item.readAtIso || now, resolvedAtIso: item.resolvedAtIso || now };
        }
        if (action === 'archive') {
          return { ...item, state: 'history', isRead: true, isArchived: true, readAtIso: item.readAtIso || now, archivedAtIso: item.archivedAtIso || now };
        }
        return { ...item, state: 'history', isRead: true, readAtIso: item.readAtIso || now };
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update notifications.');
    } finally {
      setUpdatingInbox(false);
    }
  }

  function resolveMatching(predicate: (item: Notification) => boolean) {
    const notificationIds = items
      .filter((item) => item.state === 'needs_action' && predicate(item))
      .map((item) => item.id);
    void changeNotificationState('resolve', notificationIds);
  }

  function handleNotificationOpen(item: Notification) {
    if (item.state !== 'new') return;
    void changeNotificationState('mark_read', [item.id]);
  }

  async function handleCorrectionDecision(correctionId: string, decision: 'accept' | 'reject') {
    setProcessingCorrectionIds((current) => new Set(current).add(correctionId));
    setError('');

    try {
      const response = await fetch(`/api/asset-corrections/${encodeURIComponent(correctionId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        outcome?: string;
        message?: string;
        error?: string;
      } | null;
      if (response.status === 401) {
        window.location.replace('/owner-app/login');
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to save the correction decision.');
      }

      const needsAttention =
        payload.outcome === 'accepted_revaluation_failed'
        || payload.outcome === 'accepted_revaluation_pending';
      resolveMatching((item) => item.dealerAssetCorrectionId === correctionId);
      if (needsAttention) setReloadToken((current) => current + 1);
      setOutcomeNotice({
        tone: needsAttention ? 'warning' : 'success',
        message: payload.message || (
          decision === 'reject'
            ? 'Asset update declined.'
            : 'Asset update accepted and saved.'
        ),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save the correction decision.');
    } finally {
      setProcessingCorrectionIds((current) => {
        const next = new Set(current);
        next.delete(correctionId);
        return next;
      });
    }
  }

  async function handleScheduleDecision(proposalId: string, decision: 'approve' | 'decline') {
    setProcessingScheduleProposalIds((current) => new Set(current).add(proposalId));
    setError('');
    setOutcomeNotice(null);

    try {
      const response = await fetch(`/api/dealer-maintenance-schedule-proposals/${encodeURIComponent(proposalId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;
      if (response.status === 401) {
        window.location.replace('/owner-app/login');
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to save the maintenance schedule decision.');
      }

      resolveMatching((item) => item.dealerMaintenanceScheduleProposalId === proposalId);
      setOutcomeNotice({
        tone: 'success',
        message: payload.message || (
          decision === 'approve'
            ? 'Maintenance schedule approved and added to the Asset Register.'
            : 'Maintenance schedule disapproved.'
        ),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save the maintenance schedule decision.');
    } finally {
      setProcessingScheduleProposalIds((current) => {
        const next = new Set(current);
        next.delete(proposalId);
        return next;
      });
    }
  }

  function handleDealerCostResolved(
    invoiceId: string,
    action: 'store' | 'delete',
    decision: 'approve' | 'decline' | 'keep' | 'delete',
    message: string,
  ) {
    resolveMatching((item) => item.dealerCostInvoiceId === invoiceId);
    setActiveDealerCostInvoiceId(null);
    setOutcomeNotice({
      tone: action === 'delete' && decision === 'delete' ? 'warning' : 'success',
      message: message || (
        action === 'delete'
          ? decision === 'keep'
            ? 'The cost was kept in your Cost Ledger.'
            : 'The cost was permanently deleted from your Cost Ledger.'
          : decision === 'approve'
            ? 'The dealer cost was stored in your Cost Ledger.'
            : 'The cost will remain visible to the dealer only.'
      ),
    });
    window.dispatchEvent(new Event('aim4price:cost-ledger-updated'));
  }

  async function handleCorrectionRetry(correctionId: string) {
    setProcessingCorrectionIds((current) => new Set(current).add(correctionId));
    setError('');
    setOutcomeNotice(null);

    try {
      const response = await fetch(`/api/asset-corrections/${encodeURIComponent(correctionId)}/retry`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        outcome?: string;
        message?: string;
        error?: string;
      } | null;
      if (response.status === 401) {
        window.location.replace('/owner-app/login');
        return;
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Aim4price could not retry this valuation.');
      }

      const succeeded = payload.outcome === 'accepted_revalued';
      if (succeeded) resolveMatching((item) => item.dealerAssetCorrectionId === correctionId);
      setOutcomeNotice({
        tone: succeeded ? 'success' : 'warning',
        message: payload.message || (
          succeeded
            ? 'Aim4price recalculated the asset and saved the latest estimate.'
            : 'Aim4price could not complete the recalculation.'
        ),
      });
      if (!succeeded) setReloadToken((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Aim4price could not retry this valuation.');
    } finally {
      setProcessingCorrectionIds((current) => {
        const next = new Set(current);
        next.delete(correctionId);
        return next;
      });
    }
  }

  function renderNotificationCard(item: Notification) {
    const className = [
      styles.notificationCard,
      item.state === 'needs_action' ? styles.notificationCardPriority : '',
      item.state === 'new' ? styles.notificationCardNew : '',
      item.state === 'history' ? styles.notificationCardHistory : '',
    ].filter(Boolean).join(' ');
    const cardContent = (
      <>
        <time className={styles.notificationCardTime} dateTime={item.createdAtIso}>
          {formatNotificationTime(item.createdAtIso)}
        </time>
        <h3>{item.title}</h3>
        <p>{item.body}</p>
      </>
    );

    if (item.state === 'needs_action' && item.dealerCostInvoiceId) {
      return (
        <article key={item.id} className={`${className} ${styles.notificationCorrectionCard}`}>
          {cardContent}
          <div className={styles.notificationCorrectionActions}>
            <button
              type="button"
              className={styles.notificationCorrectionAccept}
              onClick={() => setActiveDealerCostInvoiceId(item.dealerCostInvoiceId || null)}
            >
              {item.dealerCostAction === 'delete' ? 'Review deletion' : 'View cost'}
            </button>
          </div>
        </article>
      );
    }

    if (item.state === 'needs_action' && item.dealerMaintenanceScheduleProposalId) {
      const proposalId = item.dealerMaintenanceScheduleProposalId;
      const processing = processingScheduleProposalIds.has(proposalId);
      return (
        <article key={item.id} className={`${className} ${styles.notificationCorrectionCard}`}>
          {cardContent}
          <div className={styles.notificationCorrectionActions}>
            <button
              type="button"
              className={styles.notificationCorrectionDecline}
              onClick={() => void handleScheduleDecision(proposalId, 'decline')}
              disabled={processing}
            >
              {processing ? 'Saving…' : 'Disapprove'}
            </button>
            <button
              type="button"
              className={styles.notificationCorrectionAccept}
              onClick={() => void handleScheduleDecision(proposalId, 'approve')}
              disabled={processing}
            >
              {processing ? 'Saving…' : 'Approve'}
            </button>
          </div>
        </article>
      );
    }

    if (item.state === 'needs_action' && item.dealerAssetCorrectionId) {
      const correctionId = item.dealerAssetCorrectionId;
      const processing = processingCorrectionIds.has(correctionId);
      const correctionAction = item.dealerAssetCorrectionAction ?? 'decision';
      return (
        <article key={item.id} className={`${className} ${styles.notificationCorrectionCard}`}>
          {cardContent}
          <div className={styles.notificationCorrectionActions}>
            {correctionAction === 'decision' ? (
              <>
                <button
                  type="button"
                  className={styles.notificationCorrectionDecline}
                  onClick={() => void handleCorrectionDecision(correctionId, 'reject')}
                  disabled={processing}
                >
                  {processing ? 'Saving…' : 'Decline'}
                </button>
                <button
                  type="button"
                  className={styles.notificationCorrectionAccept}
                  onClick={() => void handleCorrectionDecision(correctionId, 'accept')}
                  disabled={processing}
                >
                  {processing ? 'Saving…' : 'Approve'}
                </button>
              </>
            ) : correctionAction === 'retry' ? (
              <button
                type="button"
                className={styles.notificationCorrectionAccept}
                onClick={() => void handleCorrectionRetry(correctionId)}
                disabled={processing}
              >
                {processing ? 'Retrying…' : 'Retry valuation'}
              </button>
            ) : (
              <button type="button" className={styles.notificationCorrectionDecline} disabled>
                Recalculation pending
              </button>
            )}
          </div>
        </article>
      );
    }

    return (
      <Link
        key={item.id}
        className={className}
        href={destination(item)}
        prefetch={false}
        onClick={() => handleNotificationOpen(item)}
      >
        {cardContent}
      </Link>
    );
  }

  const viewTitle = activeView === 'active' ? 'Active' : 'History';

  return (
    <>
      <div className={`${styles.content} ${styles.notificationContent}`}>
        <section className={styles.notificationIntro}>
          <div className={styles.ownerPageIntro}>
            <h1 className={styles.ownerPageTitle}>Notifications</h1>
            <p className={styles.ownerPageSubtitle}>Updates that need your attention.</p>
          </div>
        </section>

        <section className={styles.notificationWorkspace} aria-label="Notification controls">
          <div className={`${styles.notificationTabs} ${styles.notificationTabsTwo}`} role="tablist" aria-label="Notification sections">
            {([
              ['active', 'Active'],
              ['history', 'History'],
            ] as Array<[NotificationView, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeView === value}
                className={activeView === value ? styles.notificationTabActive : ''}
                onClick={() => setActiveView(value)}
              >
                <span>{label}</span>
                <strong>{counts[value]}</strong>
              </button>
            ))}
          </div>

          <label className={styles.notificationFilterSelect}>
            <span>Show</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as NotificationCategoryFilter)}
              aria-label="Filter notifications by type"
            >
              {CATEGORY_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>{filter.label}</option>
              ))}
            </select>
          </label>

          {activeView === 'active' && counts.new > 0 ? (
            <div className={styles.notificationBulkActions} aria-label="Notification actions">
                <button
                  type="button"
                  onClick={() => void changeNotificationState('mark_read', items.filter((item) => item.state === 'new').map((item) => item.id))}
                  disabled={updatingInbox || counts.new === 0}
                >
                  Mark all checked
                </button>
                <button
                  type="button"
                  className={styles.notificationClearAction}
                  onClick={() => void changeNotificationState('archive', items.filter((item) => item.state === 'new').map((item) => item.id))}
                  disabled={updatingInbox || counts.new === 0}
                >
                  Clear all
                </button>
            </div>
          ) : null}
        </section>

        {error ? (
          <div className={`${styles.errorNotice} ${styles.notificationError}`} role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setReloadToken((current) => current + 1)}>Try again</button>
          </div>
        ) : null}

        {outcomeNotice ? (
          <div
            className={`${styles.notificationOutcomeNotice} ${
              outcomeNotice.tone === 'success'
                ? styles.notificationOutcomeSuccess
                : styles.notificationOutcomeWarning
            }`}
            role="status"
          >
            <span aria-hidden="true">{outcomeNotice.tone === 'success' ? '✓' : '!'}</span>
            <p>{outcomeNotice.message}</p>
            <button type="button" onClick={() => setOutcomeNotice(null)} aria-label="Dismiss message">×</button>
          </div>
        ) : null}

        {!error && !loading ? (
          <section className={styles.notificationSection} aria-labelledby="notification-results-title">
            <div className={`${styles.notificationSectionHeading} ${styles.ownerSectionHeading}`}>
              <h2 id="notification-results-title">{viewTitle}</h2>
              <span aria-label={`${visibleItems.length} notifications`}>{visibleItems.length}</span>
            </div>

            {visibleItems.length ? (
              <div className={styles.notificationList} aria-live="polite">
                {visibleItems.map(renderNotificationCard)}
              </div>
            ) : (
              <p className={styles.notificationEmpty} aria-live="polite">
                {activeView === 'active'
                  ? 'You’re all caught up. Active notifications will appear here.'
                  : 'Your checked and cleared notifications will appear here.'}
              </p>
            )}
          </section>
        ) : null}

        {!error && loading ? (
          <p className={styles.notificationEmpty} role="status">Loading notifications…</p>
        ) : null}
      </div>

      <DealerCostDecisionModal
        invoiceId={activeDealerCostInvoiceId}
        loginHref="/owner-app/login"
        onClose={() => setActiveDealerCostInvoiceId(null)}
        onResolved={(action, decision, message) => {
          if (!activeDealerCostInvoiceId) return;
          handleDealerCostResolved(activeDealerCostInvoiceId, action, decision, message);
        }}
      />
    </>
  );
}
