'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import FieldManagerNavLink from './field-manager-nav-link';
import FieldManagerServiceLocationModal from './field-manager-service-location-modal';
import OverviewClearConfirmation from './overview-clear-confirmation';
import styles from './page.module.css';

type OverviewRange = 'week' | 'upcoming';
type OverviewItemType = 'problem' | 'service' | 'checkup' | 'license';
type OverviewSection = 'needs_attention' | 'coming_up';
type OverviewStatus = 'problem' | 'overdue' | 'due' | 'due_soon' | 'upcoming' | 'usage_needed';

type OverviewItem = {
  id: string;
  sourceId: string;
  type: OverviewItemType;
  section: OverviewSection;
  status: OverviewStatus;
  statusLabel: string;
  assetId: string;
  assetTitle: string;
  headline: string;
  detail: string;
  notes: string;
  isRecurringFollowUp: boolean;
  createdAtIso: string;
  sortTimestamp: string | null;
  sortValue: number | null;
  openAsset: true;
};

type OverviewApiResponse = {
  ok: boolean;
  range?: OverviewRange;
  items?: OverviewItem[];
  error?: string;
};

type OpenAssetApiResponse = {
  ok: boolean;
  assetId?: string;
  publicAssetCode?: string;
  redirectTo?: string;
  error?: string;
};

type LocationGateRequest = {
  assetTitle: string;
  assetId: string;
  publicAssetCode: string;
  redirectTo: string;
};

const TYPE_LABELS: Record<OverviewItemType, string> = {
  problem: 'Problem',
  service: 'Service',
  checkup: 'Checkup',
  license: 'Licence',
};

const STATUS_LABELS: Record<OverviewStatus, string> = {
  problem: 'Problem',
  overdue: 'Overdue',
  due: 'Due now',
  due_soon: 'Due soon',
  upcoming: 'Upcoming',
  usage_needed: 'Usage needed',
};

function extractError(payload: { error?: string } | null, fallback: string): string {
  return payload?.error?.trim() || fallback;
}

function cardClassName(item: OverviewItem): string {
  const attentionClass = item.section === 'needs_attention'
    ? styles.overviewCardNeedsAttention
    : item.status === 'due_soon'
      ? styles.overviewCardDueSoon
      : '';
  const recurringClass = item.isRecurringFollowUp ? styles.overviewRecurringCard : '';

  return [styles.overviewCard, attentionClass, recurringClass].filter(Boolean).join(' ');
}

function statusText(item: OverviewItem): string {
  return item.statusLabel.trim() || STATUS_LABELS[item.status];
}

export default function FieldManagerOverviewClient() {
  const range: OverviewRange = 'upcoming';
  const [items, setItems] = useState<OverviewItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openingItemId, setOpeningItemId] = useState<string | null>(null);
  const [clearingItemId, setClearingItemId] = useState<string | null>(null);
  const [clearCandidate, setClearCandidate] = useState<OverviewItem | null>(null);
  const [locationGate, setLocationGate] = useState<LocationGateRequest | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const visibleItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return items;

    return items.filter((item) => [
      item.assetTitle,
      item.headline,
      item.detail,
      item.notes,
      TYPE_LABELS[item.type],
      statusText(item),
    ].join(' ').toLocaleLowerCase().includes(normalizedQuery));
  }, [items, searchQuery]);
  const needsAttentionItems = useMemo(
    () => visibleItems.filter((item) => item.section === 'needs_attention'),
    [visibleItems],
  );
  const comingUpItems = useMemo(
    () => visibleItems.filter((item) => item.section === 'coming_up'),
    [visibleItems],
  );
  const hasSearchQuery = searchQuery.trim().length > 0;

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    async function loadOverview() {
      if (!hasLoadedRef.current) setIsLoading(true);
      setLoadError(null);
      setActionError(null);

      try {
        const response = await fetch(`/api/field-manager/overview?range=${range}`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as OverviewApiResponse | null;

        if (response.status === 401) {
          window.location.replace('/field-manager/login');
          return;
        }

        if (!response.ok || !payload?.ok || !Array.isArray(payload.items)) {
          throw new Error(extractError(payload, 'Failed to load your overview.'));
        }

        if (requestId === requestIdRef.current) {
          setItems(payload.items);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        if (requestId === requestIdRef.current) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load your overview.');
        }
      } finally {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          hasLoadedRef.current = true;
          setIsLoading(false);
        }
      }
    }

    void loadOverview();
    return () => controller.abort();
  }, [reloadToken]);

  useEffect(() => {
    const refresh = () => setReloadToken((current) => current + 1);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const interval = window.setInterval(refresh, 30_000);

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  async function handleOpenAsset(item: OverviewItem) {
    setOpeningItemId(item.id);
    setActionError(null);

    try {
      const response = await fetch(
        `/api/field-manager/assets/${encodeURIComponent(item.assetId)}/open`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          cache: 'no-store',
          body: JSON.stringify({
            overviewItemId: item.id,
            sourceId: item.sourceId,
            overviewRange: range,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as OpenAssetApiResponse | null;

      if (response.status === 401) {
        window.location.replace('/field-manager/login');
        return;
      }

      if (
        !response.ok
        || !payload?.ok
        || !payload.redirectTo
        || !payload.assetId
        || !payload.publicAssetCode
      ) {
        throw new Error(extractError(payload, 'This asset cannot be opened.'));
      }

      setLocationGate({
        assetTitle: item.assetTitle,
        assetId: payload.assetId,
        publicAssetCode: payload.publicAssetCode,
        redirectTo: payload.redirectTo,
      });
      setOpeningItemId(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'This asset cannot be opened.');
      setOpeningItemId(null);
    }
  }

  async function handleClearItem(
    item: OverviewItem,
    outcome: 'clear' | 'completed' | 'problem_done',
  ) {
    setClearingItemId(item.id);
    setActionError(null);

    try {
      const response = await fetch('/api/field-manager/overview/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          range,
          itemId: item.id,
          sourceId: item.sourceId,
          outcome,
        }),
      });
      const payload = (await response.json().catch(() => null)) as OverviewApiResponse | null;

      if (response.status === 401) {
        window.location.replace('/field-manager/login');
        return;
      }

      if (!response.ok || !payload?.ok) {
        throw new Error(extractError(payload, 'This item could not be cleared.'));
      }

      if (Array.isArray(payload.items)) {
        setItems(payload.items);
      } else {
        setItems((current) => current.filter(
          (candidate) => candidate.id !== item.id || candidate.sourceId !== item.sourceId,
        ));
      }
      setClearCandidate(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'This item could not be cleared.');
      setClearCandidate(null);
    } finally {
      setClearingItemId(null);
    }
  }

  function renderOverviewCard(item: OverviewItem) {
    const isOpening = openingItemId === item.id;
    const isClearing = clearingItemId === item.id;
    const hasPendingCardAction = Boolean(openingItemId) || Boolean(clearingItemId);

    return (
      <article
        key={`${item.id}:${item.sourceId}`}
        className={cardClassName(item)}
      >
        {item.isRecurringFollowUp ? <p className={styles.overviewRecurringNotice}>Next recurring maintenance</p> : null}
        <h3>{item.assetTitle}</h3>
        <p className={styles.overviewHeadline}>{item.headline}</p>
        {item.detail.trim() ? <p className={styles.overviewDetail}>{item.detail}</p> : null}
        {item.notes.trim() ? <p className={styles.overviewNotes}>{item.notes}</p> : null}

        <div className={styles.overviewCardActions}>
          <button
            type="button"
            className={styles.overviewClearButton}
            onClick={() => setClearCandidate(item)}
            disabled={hasPendingCardAction}
            aria-busy={isClearing}
            aria-label={`Clear ${TYPE_LABELS[item.type].toLowerCase()} for ${item.assetTitle} from Overview`}
          >
            {isClearing ? 'Clearing…' : 'Clear'}
          </button>
          <button
            type="button"
            className={`${styles.mobilePrimaryButton} ${styles.overviewOpenButton}`}
            onClick={() => void handleOpenAsset(item)}
            disabled={hasPendingCardAction || !item.openAsset}
            aria-busy={isOpening}
          >
            {isOpening ? 'Preparing…' : 'Open'}
          </button>
        </div>
      </article>
    );
  }

  return (
    <main className={`${styles.mobilePage} ${styles.overviewPage}`}>
      <section className={`${styles.assetsShell} ${styles.overviewShell}`}>
        <header className={styles.assetsHeader} aria-label="Overview controls">
          <FieldManagerNavLink href="/field-manager" label="Home" />
        </header>

        <div className={styles.overviewIntro}>
          <h1>Overview</h1>
          <p>Needs attention and upcoming maintenance.</p>
        </div>

        <label className={styles.overviewSearch}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search assets or maintenance"
            aria-label="Search overview"
          />
        </label>

        {loadError ? (
          <div className={`${styles.errorNotice} ${styles.overviewError}`} role="alert">
            <span>{loadError}</span>
            <button type="button" onClick={() => setReloadToken((current) => current + 1)}>
              Try again
            </button>
          </div>
        ) : null}

        {actionError ? (
          <div className={styles.errorNotice} role="alert">
            {actionError}
          </div>
        ) : null}

        {isLoading ? (
          <p className={styles.mobileEmpty} role="status">
            Loading your overview…
          </p>
        ) : null}

        {!isLoading && !loadError ? (
          <div className={styles.overviewSections} aria-live="polite">
            <section className={styles.overviewSection} aria-labelledby="needs-attention-title">
              <div className={styles.overviewSectionHeading}>
                <h2 id="needs-attention-title">Needs attention</h2>
                <span aria-label={`${needsAttentionItems.length} items`}>
                  {needsAttentionItems.length}
                </span>
              </div>
              {needsAttentionItems.length ? (
                <div className={styles.overviewList}>{needsAttentionItems.map(renderOverviewCard)}</div>
              ) : (
                <p className={styles.overviewEmpty}>
                  {hasSearchQuery ? 'No matching items need attention.' : 'Nothing needs attention.'}
                </p>
              )}
            </section>

            <section className={styles.overviewSection} aria-labelledby="upcoming-title">
              <div className={styles.overviewSectionHeading}>
                <h2 id="upcoming-title">Upcoming</h2>
                <span aria-label={`${comingUpItems.length} items`}>{comingUpItems.length}</span>
              </div>
              {comingUpItems.length ? (
                <div className={styles.overviewList}>{comingUpItems.map(renderOverviewCard)}</div>
              ) : (
                <p className={styles.overviewEmpty}>
                  {hasSearchQuery ? 'No matching upcoming items.' : 'Nothing upcoming.'}
                </p>
              )}
            </section>
          </div>
        ) : null}

        {clearCandidate ? (
          <OverviewClearConfirmation
            assetTitle={clearCandidate.assetTitle}
            itemLabel={TYPE_LABELS[clearCandidate.type]}
            itemType={clearCandidate.type}
            isClearing={clearingItemId === clearCandidate.id}
            clearsForEveryone
            onCancel={() => setClearCandidate(null)}
            onConfirm={({ outcome }) => void handleClearItem(clearCandidate, outcome)}
          />
        ) : null}

        {locationGate ? (
          <FieldManagerServiceLocationModal
            {...locationGate}
            onCancel={() => setLocationGate(null)}
            onError={(message) => setActionError(message)}
          />
        ) : null}
      </section>
    </main>
  );
}
