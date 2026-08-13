'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../../field-manager/page.module.css';
import OverviewClearConfirmation from '../../field-manager/overview-clear-confirmation';
import ownerStyles from '../owner-app.module.css';
import OwnerAppNav from '../owner-app-nav';
import OwnerServiceLocationModal from '../owner-service-location-modal';

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
};

type OverviewApiResponse = {
  ok?: boolean;
  items?: OverviewItem[];
  canClearForEveryone?: boolean;
  error?: string;
};

type OwnerAssetApiResponse = {
  ok?: boolean;
  item?: {
    id?: string;
    publicAssetCode?: string;
  };
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

export default function OwnerAttentionClient() {
  const range: OverviewRange = 'upcoming';
  const [items, setItems] = useState<OverviewItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openingItemId, setOpeningItemId] = useState<string | null>(null);
  const [clearingItemId, setClearingItemId] = useState<string | null>(null);
  const [clearCandidate, setClearCandidate] = useState<OverviewItem | null>(null);
  const [canClearForEveryone, setCanClearForEveryone] = useState(false);
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
        const response = await fetch(`/api/owner-app/attention?range=${range}`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as OverviewApiResponse | null;

        if (response.status === 401) {
          window.location.replace('/owner-app/login');
          return;
        }

        if (!response.ok || !payload?.ok || !Array.isArray(payload.items)) {
          throw new Error(extractError(payload, 'Failed to load your Overview.'));
        }

        if (requestId === requestIdRef.current) {
          setItems(payload.items);
          setCanClearForEveryone(payload.canClearForEveryone === true);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        if (requestId === requestIdRef.current) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load your Overview.');
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
    let destination = `/owner-app/assets/${encodeURIComponent(item.assetId)}`;

    if (item.type !== 'service' && item.type !== 'checkup') {
      window.location.assign(destination);
      return;
    }

    const query = new URLSearchParams({
      maintenanceId: item.sourceId,
      maintenanceType: item.type,
      returnTo: '/owner-app/attention',
    });
    destination = `/owner-app/operations/maintenance/${encodeURIComponent(item.assetId)}?${query.toString()}`;

    try {
      const response = await fetch(`/api/owner-app/assets/${encodeURIComponent(item.assetId)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as OwnerAssetApiResponse | null;

      if (response.status === 401) {
        window.location.replace('/owner-app/login');
        return;
      }

      const publicAssetCode = payload?.item?.publicAssetCode?.trim();
      if (!response.ok || !payload?.ok || !publicAssetCode) {
        throw new Error(extractError(payload, 'This service cannot be opened.'));
      }

      setLocationGate({
        assetTitle: item.assetTitle,
        assetId: item.assetId,
        publicAssetCode,
        redirectTo: destination,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'This service cannot be opened.');
    } finally {
      setOpeningItemId(null);
    }
  }

  async function handleClearItem(
    item: OverviewItem,
    outcome: 'clear' | 'completed' | 'problem_done',
    clearForEveryone: boolean,
  ) {
    setClearingItemId(item.id);
    setActionError(null);

    try {
      const response = await fetch('/api/owner-app/attention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          range,
          itemId: item.id,
          sourceId: item.sourceId,
          outcome,
          clearForEveryone,
        }),
      });
      const payload = (await response.json().catch(() => null)) as OverviewApiResponse | null;

      if (response.status === 401) {
        window.location.replace('/owner-app/login');
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
            aria-label={`Clear ${TYPE_LABELS[item.type].toLowerCase()} for ${item.assetTitle} from your Overview`}
          >
            {isClearing ? 'Clearing…' : 'Clear'}
          </button>
          <button
            type="button"
            className={`${styles.mobilePrimaryButton} ${styles.overviewOpenButton} ${ownerStyles.overviewOpenAction}`}
            onClick={() => void handleOpenAsset(item)}
            disabled={hasPendingCardAction}
            aria-busy={isOpening}
          >
            {isOpening ? 'Opening…' : 'Open'}
          </button>
        </div>
      </article>
    );
  }

  return (
    <main className={`${styles.mobilePage} ${ownerStyles.page} ${ownerStyles.overviewPage}`}>
      <OwnerAppNav />
      <section className={`${styles.overviewShell} ${ownerStyles.overviewContent}`}>

        <div className={`${styles.overviewIntro} ${ownerStyles.ownerPageIntro}`}>
          <h1 className={ownerStyles.ownerPageTitle}>Overview</h1>
          <p className={ownerStyles.ownerPageSubtitle}>Needs attention and upcoming maintenance.</p>
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
            Loading your Overview…
          </p>
        ) : null}

        {!isLoading && !loadError ? (
          <div className={styles.overviewSections} aria-live="polite">
            <section className={styles.overviewSection} aria-labelledby="needs-attention-title">
              <div className={`${styles.overviewSectionHeading} ${ownerStyles.ownerSectionHeading}`}>
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
              <div className={`${styles.overviewSectionHeading} ${ownerStyles.ownerSectionHeading}`}>
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
            canClearForEveryone={canClearForEveryone}
            onCancel={() => setClearCandidate(null)}
            onConfirm={({ outcome, clearForEveryone }) => void handleClearItem(
              clearCandidate,
              outcome,
              clearForEveryone,
            )}
          />
        ) : null}

        {locationGate ? (
          <OwnerServiceLocationModal
            {...locationGate}
            onCancel={() => setLocationGate(null)}
            onError={setActionError}
          />
        ) : null}
      </section>
    </main>
  );
}
