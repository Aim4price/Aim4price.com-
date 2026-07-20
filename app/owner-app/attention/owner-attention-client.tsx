'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../../field-manager/page.module.css';
import ownerStyles from '../owner-app.module.css';
import OwnerAppNav from '../owner-app-nav';

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
};

type OverviewApiResponse = {
  ok?: boolean;
  items?: OverviewItem[];
  error?: string;
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

function extractError(payload: OverviewApiResponse | null, fallback: string): string {
  return payload?.error?.trim() || fallback;
}

function statusClassName(item: OverviewItem): string {
  if (item.status === 'problem' || item.status === 'overdue' || item.status === 'due') {
    return `${styles.overviewStatus} ${styles.overviewStatusUrgent}`;
  }

  if (item.section === 'coming_up') {
    return `${styles.overviewStatus} ${styles.overviewStatusUpcoming}`;
  }

  return `${styles.overviewStatus} ${styles.overviewStatusNeutral}`;
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
  const [reloadToken, setReloadToken] = useState(0);
  const requestIdRef = useRef(0);

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
      setIsLoading(true);
      setLoadError(null);
      setActionError(null);
      setItems([]);

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
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        if (requestId === requestIdRef.current) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load your Overview.');
        }
      } finally {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }

    void loadOverview();
    return () => controller.abort();
  }, [reloadToken]);

  function handleOpenAsset(item: OverviewItem) {
    setOpeningItemId(item.id);
    setActionError(null);
    window.location.assign(`/owner-app/assets/${encodeURIComponent(item.assetId)}`);
  }

  async function handleClearItem(item: OverviewItem) {
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

      setItems((current) => current.filter(
        (candidate) => candidate.id !== item.id || candidate.sourceId !== item.sourceId,
      ));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'This item could not be cleared.');
    } finally {
      setClearingItemId(null);
    }
  }

  function renderOverviewCard(item: OverviewItem) {
    const isOpening = openingItemId === item.id;
    const isClearing = clearingItemId === item.id;
    const hasPendingCardAction = Boolean(openingItemId) || Boolean(clearingItemId);

    return (
      <article key={`${item.id}:${item.sourceId}`} className={styles.overviewCard}>
        <div className={styles.overviewCardLabels}>
          <span className={styles.overviewType}>{TYPE_LABELS[item.type]}</span>
          <span className={statusClassName(item)}>{statusText(item)}</span>
        </div>

        <h3>{item.assetTitle}</h3>
        <p className={styles.overviewHeadline}>{item.headline}</p>
        {item.detail.trim() ? <p className={styles.overviewDetail}>{item.detail}</p> : null}
        {item.notes.trim() ? <p className={styles.overviewNotes}>{item.notes}</p> : null}

        <div className={styles.overviewCardActions}>
          <button
            type="button"
            className={styles.overviewClearButton}
            onClick={() => void handleClearItem(item)}
            disabled={hasPendingCardAction}
            aria-busy={isClearing}
            aria-label={`Clear ${TYPE_LABELS[item.type].toLowerCase()} for ${item.assetTitle} from your Overview`}
          >
            {isClearing ? 'Clearing…' : 'Clear'}
          </button>
          <button
            type="button"
            className={`${styles.mobilePrimaryButton} ${styles.overviewOpenButton} ${ownerStyles.overviewOpenAction}`}
            onClick={() => handleOpenAsset(item)}
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
      </section>
    </main>
  );
}
