'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import FieldManagerNavLink from './field-manager-nav-link';
import styles from './page.module.css';

type OverviewRange = 'week' | 'month';
type OverviewItemType = 'problem' | 'service' | 'checkup' | 'license';
type OverviewSection = 'needs_attention' | 'coming_up';
type OverviewStatus = 'problem' | 'overdue' | 'due' | 'due_soon' | 'upcoming' | 'usage_needed';

type OverviewSummary = {
  totalCount: number;
  needsAttentionCount: number;
  comingUpCount: number;
};

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
  sortTimestamp: string | null;
  sortValue: number | null;
  openAsset: true;
};

type OverviewApiResponse = {
  ok: boolean;
  range?: OverviewRange;
  summary?: OverviewSummary;
  items?: OverviewItem[];
  error?: string;
};

type OpenAssetApiResponse = {
  ok: boolean;
  redirectTo?: string;
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

function extractError(payload: { error?: string } | null, fallback: string): string {
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

export default function FieldManagerOverviewClient({
  initialRange = 'week',
}: {
  initialRange?: OverviewRange;
}) {
  const [range, setRange] = useState<OverviewRange>(initialRange);
  const [items, setItems] = useState<OverviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openingItemId, setOpeningItemId] = useState<string | null>(null);
  const [clearingItemId, setClearingItemId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const requestIdRef = useRef(0);

  const needsAttentionItems = useMemo(
    () => items.filter((item) => item.section === 'needs_attention'),
    [items],
  );
  const comingUpItems = useMemo(
    () => items.filter((item) => item.section === 'coming_up'),
    [items],
  );

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    async function loadOverview() {
      setIsLoading(true);
      setLoadError(null);
      setActionError(null);
      setItems([]);

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
  }, [range, reloadToken]);

  async function handleLogout() {
    setIsSigningOut(true);
    await fetch('/api/field-manager/login', {
      method: 'DELETE',
      credentials: 'include',
      cache: 'no-store',
    }).catch(() => undefined);
    window.location.replace('/field-manager/login');
  }

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

      if (!response.ok || !payload?.ok || !payload.redirectTo) {
        throw new Error(extractError(payload, 'This asset cannot be opened.'));
      }

      window.location.assign(payload.redirectTo);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'This asset cannot be opened.');
      setOpeningItemId(null);
    }
  }

  async function handleClearItem(item: OverviewItem) {
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
            className={`${styles.mobilePrimaryButton} ${styles.overviewOpenButton}`}
            onClick={() => void handleOpenAsset(item)}
            disabled={hasPendingCardAction || !item.openAsset}
            aria-busy={isOpening}
          >
            {isOpening ? 'Opening…' : 'Open asset'}
          </button>
        </div>
      </article>
    );
  }

  return (
    <main className={styles.mobilePage}>
      <section className={`${styles.assetsShell} ${styles.overviewShell}`}>
        <header className={styles.overviewHeader} aria-label="Overview controls">
          <FieldManagerNavLink href="/field-manager" label="Home" />
          <button
            type="button"
            className={styles.logoutButton}
            onClick={() => void handleLogout()}
            disabled={isSigningOut}
          >
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </header>

        <div className={styles.overviewIntro}>
          <span>Field Manager</span>
          <h1>Overview</h1>
          <p>What needs attention next.</p>
        </div>

        <div className={styles.overviewRange} role="group" aria-label="Overview time range">
          <button
            type="button"
            className={range === 'week' ? styles.overviewRangeActive : undefined}
            aria-pressed={range === 'week'}
            onClick={() => setRange('week')}
          >
            Next 7 days
          </button>
          <button
            type="button"
            className={range === 'month' ? styles.overviewRangeActive : undefined}
            aria-pressed={range === 'month'}
            onClick={() => setRange('month')}
          >
            Next 30 days
          </button>
        </div>

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
              <div className={styles.overviewSectionHeading}>
                <h2 id="needs-attention-title">Needs attention</h2>
                <span aria-label={`${needsAttentionItems.length} items`}>
                  {needsAttentionItems.length}
                </span>
              </div>
              {needsAttentionItems.length ? (
                <div className={styles.overviewList}>{needsAttentionItems.map(renderOverviewCard)}</div>
              ) : (
                <p className={styles.overviewEmpty}>Nothing needs attention.</p>
              )}
            </section>

            <section className={styles.overviewSection} aria-labelledby="coming-up-title">
              <div className={styles.overviewSectionHeading}>
                <h2 id="coming-up-title">Coming up</h2>
                <span aria-label={`${comingUpItems.length} items`}>{comingUpItems.length}</span>
              </div>
              {comingUpItems.length ? (
                <div className={styles.overviewList}>{comingUpItems.map(renderOverviewCard)}</div>
              ) : (
                <p className={styles.overviewEmpty}>
                  Nothing coming up in the next {range === 'week' ? '7 days' : '30 days'}.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
